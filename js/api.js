import { gyms } from './gyms-data.js'

const CACHE_KEY = 'apiCache';
const CACHE_MAX_AGE = 15 * 60 * 1000;  // Spots left change quickly, so refetch after 15 minutes

let cache = {};  // In-memory cache, mirrored to localStorage
let instructorCache = null;  // Cache for instructor data
let cacheTimestamp = null;  // Global timestamp for cache validation

// Helper function to get today's date as a string (e.g., "2024-01-01")
function getCurrentDateString() {
    return new Date().toISOString().split('T')[0];  // Only the date part in "YYYY-MM-DD" format
}

function loadPersistedCache() {
    try {
        const stored = JSON.parse(localStorage.getItem(CACHE_KEY));
        if (stored && stored.date === getCurrentDateString()) {
            cache = stored.cache || {};
            instructorCache = stored.instructorCache || null;
            cacheTimestamp = stored.date;
        }
    } catch (e) {
        console.warn("Could not read persisted cache", e);
    }
}

function persistCache() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ date: cacheTimestamp, cache, instructorCache }));
    } catch (e) {
        console.warn("Could not persist cache", e);
    }
}

loadPersistedCache();

// Function to clear the cache when the date has changed
function invalidateCacheIfNeeded() {
    const currentDate = getCurrentDateString();

    // Invalidate the cache if the stored timestamp is not from today
    if (cacheTimestamp !== currentDate) {
        console.log("Cache invalidated. Fetching fresh data.");
        cache = {};  // Clear the cache
        instructorCache = null;  // Clear instructor cache
        cacheTimestamp = currentDate;  // Set the new timestamp
    }
}

// Fetch data from API and cache it
async function fetchData(businessUnit) {

    // Check if the data for this business unit is already cached and fresh enough
    const cached = cache[businessUnit];
    if (cached && Date.now() - cached.fetchedAt < CACHE_MAX_AGE) {
        console.log(`Returning cached data for business unit ${businessUnit}`);
        return cached.data;  // Return cached data
    }

    // Fetch fresh data from the API
    console.log(`Fetching fresh data for business unit ${businessUnit}`);
    const now = Date.now();
    const start = (new Date(now)).toISOString().replaceAll(":", "%3A");
    const duration = 1123200000; // 13 days in milliseconds
    const end = (new Date(now + duration)).toISOString().substring(0, 10) + "T21%3A59%3A59.999Z"
    const url = `https://friskissvettis.brpsystems.com/brponline/api/ver3/businessunits/${businessUnit}/groupactivities?period.end=${end}&period.start=${start}&webCategory=22`;

    let data;
    try {
        const response = await fetch(url);
        data = await response.json();
    } catch (e) {
        if (cached) {
            console.warn(`Fetch failed for business unit ${businessUnit}, using stale cache`, e);
            return cached.data;
        }
        throw e;
    }

    // Cache the data
    cache[businessUnit] = { fetchedAt: Date.now(), data };
    persistCache();

    return data;
}

// Looks up a raw class by id in whatever gyms are cached (used to enrich bookings)
export function findCachedActivity(id) {
    for (const entry of Object.values(cache)) {
        const hit = entry.data?.find(item => item.id === id);
        if (hit) return hit;
    }
    return null;
}

// Function to convert locations to IDs
function getGymIdsFromLocations(locations) {
    return gyms
        .filter(gym => locations.includes(gym.location))  // Filter gyms by matching locations
        .map(gym => gym.id);  // Map the filtered gyms to their IDs
}


export async function fetchAllData(locationsArray) {
    // First, check if the cache needs to be invalidated
    invalidateCacheIfNeeded();

    const gymIds = getGymIdsFromLocations(locationsArray);

    const results = await Promise.all(gymIds.map(id => fetchData(id)));

    // Flatten the results and return them
    return results.flat();
}

// Function to get all gym locations
export function getAllLocations() {
    return gyms.map(gym => gym.location);
}

// Classify how full a class is: 'cancelled', 'dropin', 'full', 'almost' or 'open'
function capacityStatus(item, slots) {
    if (item.cancelled) return 'cancelled';
    if (!slots) return 'open';
    if (slots.totalBookable === 0) return 'dropin';  // All spots reserved for drop-in, nothing to book online
    if (slots.leftToBook <= 0) return 'full';
    if (slots.leftToBook <= 3 || slots.leftToBook / slots.totalBookable <= 0.1) return 'almost';
    return 'open';
}

function formatInstructors(instructors) {
    const names = instructors.map(i => i.isSubstitute ? `${i.name} (vik.)` : i.name);
    if (names.length === 0) return "---";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return `${names[0]} m. fl.`;
}

// Function to transform the fetched data
export function transformItem(item) {
    const days = ["Sö", "Må", "Ti", "On", "To", "Fr", "Lö"];
    const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    var date = new Date(item.duration.start);
    const zeroPad = (num, places) => String(num).padStart(places, '0')
    const slots = item.slots || null;

    return {
        id: item.id,
        activity: item.name,
        date,
        endDate: new Date(item.duration.end),
        instructor: formatInstructors(item.instructors),
        instructors: item.instructors.map(i => i.name),
        location: item.businessUnit.name.replace("Stockholm -", ""),
        room: item.locations?.map(l => l.name).join(", ") || "",
        startTime: `${days[date.getDay()]} ${zeroPad(date.getDate(), 2)} ${months[date.getMonth()]}. ${zeroPad(date.getHours(), 2)}:${zeroPad(date.getMinutes(), 2)}`,
        cancelled: !!item.cancelled,
        total: slots?.totalBookable ?? null,
        booked: slots ? slots.totalBookable - slots.leftToBook : null,
        leftToBook: slots?.leftToBook ?? null,
        dropinSpots: slots?.leftToBookIncDropin ?? 0,
        hasWaitingList: !!slots?.hasWaitingList,
        inWaitingList: slots?.inWaitingList ?? 0,
        status: capacityStatus(item, slots),
        bookableEarliest: item.bookableEarliest ? new Date(item.bookableEarliest) : null,
        bookableLatest: item.bookableLatest ? new Date(item.bookableLatest) : null,
        message: item.externalMessage || ""
    };
}

// Helper function to fetch and extract unique items (e.g., instructors or activities)
async function getUniqueItems(extractFn) {
    const locations = getAllLocations();
    const rawData = await fetchAllData(locations);
    const transformedData = rawData.map(item => transformItem(item));

    const uniqueItems = new Set(transformedData.map(extractFn)); // Extract the unique items
    return Array.from(uniqueItems).sort(); // Return sorted unique items
}

// Fetch instructors from API and cache them
async function fetchInstructors() {
    // Check if instructors are already cached
    if (instructorCache) {
        console.log("Returning cached instructor data");
        return instructorCache;
    }

    // Fetch fresh instructor data from the API
    console.log("Fetching fresh instructor data");
    const url = "https://friskissvettis.brpsystems.com/brponline/api/ver3/apps/59/resources?includeAssets=true&includeBusinessUnitIds=true";
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Get gym IDs for filtering
    const gymIds = new Set(gyms.map(gym => gym.id));
    
    // Filter instructors that work at relevant gyms
    const relevantInstructors = data
        .filter(resource => resource.type === "STAFF")
        .filter(instructor => instructor.businessUnitIds.some(id => gymIds.has(id)))
        .map(instructor => ({
            id: instructor.id,
            name: instructor.name,
            businessUnitIds: instructor.businessUnitIds
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

    // Cache the instructor data
    instructorCache = relevantInstructors;
    persistCache();

    return relevantInstructors;
}

// Function to get unique instructors
export async function getInstructors() {
    // First, check if the cache needs to be invalidated
    invalidateCacheIfNeeded();
    
    const instructors = await fetchInstructors();
    return instructors.map(instructor => instructor.name);
}

// Function to get unique activities
export function getActivities() {
    return getUniqueItems(item => item.activity);
}
