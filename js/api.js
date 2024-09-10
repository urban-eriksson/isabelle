import {gyms} from './gyms-data.js'

let cache = {};  // In-memory cache
let cacheTimestamp = null;  // Global timestamp for cache validation

// Helper function to get today's date as a string (e.g., "2024-01-01")
function getCurrentDateString() {
    return new Date().toISOString().split('T')[0];  // Only the date part in "YYYY-MM-DD" format
}

// Function to clear the cache when the date has changed
function invalidateCacheIfNeeded() {
    const currentDate = getCurrentDateString();

    // Invalidate the cache if the stored timestamp is not from today
    if (cacheTimestamp !== currentDate) {
        console.log("Cache invalidated. Fetching fresh data.");
        cache = {};  // Clear the cache
        cacheTimestamp = currentDate;  // Set the new timestamp
    }
}

// Fetch data from API and cache it
async function fetchData(businessUnit) {

    // Check if the data for this business unit is already cached
    if (cache[businessUnit]) {
        console.log(`Returning cached data for business unit ${businessUnit}`);
        return cache[businessUnit];  // Return cached data
    }

    // Fetch fresh data from the API
    console.log(`Fetching fresh data for business unit ${businessUnit}`);
    const now = Date.now();
    const start = (new Date(now)).toISOString().replaceAll(":", "%3A");
    const duration = 1123200000; // 13 days in milliseconds
    const end = (new Date(now + duration)).toISOString().substring(0, 10) + "T21%3A59%3A59.999Z"    
    const url = `https://friskissvettis.brpsystems.com/brponline/api/ver3/businessunits/${businessUnit}/groupactivities?period.end=${end}&period.start=${start}&webCategory=22`;

    const response = await fetch(url);
    const data = await response.json();

    // Cache the data
    cache[businessUnit] = data;

    return data;
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

// Function to transform the fetched data
export function transformItem(item) {
    const days = ["Sö", "Må", "Ti", "On", "To", "Fr", "Lö"];
    const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
    var date = new Date(item.duration.start);
    const zeroPad = (num, places) => String(num).padStart(places, '0')
    const location = item.businessUnit.name.replace("Stockholm -", "")
    const instructor = item.instructors.length > 1 
        ? `${item.instructors[0].name} m. fl.` 
        : (item.instructors[0]?.name || "---");

    return {
        activity: item.name,
        date,
        instructor,
        location: item.businessUnit.name.replace("Stockholm -", ""),
        startTime: `${days[date.getDay()]} ${zeroPad(date.getDate(), 2)} ${months[date.getMonth()]}. ${zeroPad(date.getHours(), 2)}:${zeroPad(date.getMinutes(), 2)}`
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

// Function to get unique instructors
export function getInstructors() {
    return getUniqueItems(item => item.instructor);
}

// Function to get unique activities
export function getActivities() {
    return getUniqueItems(item => item.activity);
}
