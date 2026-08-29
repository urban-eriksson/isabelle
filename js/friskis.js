// Client for the authenticated parts of the Friskis & Svettis (BRP) API:
// login, token refresh and the customer's class bookings. Everything runs in
// the browser; tokens live in localStorage and never leave the device.
import * as push from './push.js';

const API = 'https://friskissvettis.brpsystems.com/brponline/api/ver3';
const OAUTH = 'https://friskissvettis.brpsystems.com/brponline/oauth/access_token';
const SESSION_KEY = 'friskisSession';
const BOOKINGS_KEY = 'friskisBookings';

let session = loadJson(SESSION_KEY);
let bookings = loadJson(BOOKINGS_KEY) || [];
const listeners = new Set();

function loadJson(key) {
    try {
        return JSON.parse(localStorage.getItem(key));
    } catch (e) {
        return null;
    }
}

function saveJson(key, value) {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
}

function notify() {
    listeners.forEach(fn => fn());
}

// Subscribe to login/logout/booking changes
export function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function isLoggedIn() {
    return !!session?.accessToken;
}

export class ApiError extends Error {
    constructor(status, body) {
        super(body?.message || body?.errorMessage || body?.code || `HTTP ${status}`);
        this.status = status;
        this.code = body?.code || body?.errorCode || null;
        this.body = body;
    }
}

async function parseResponse(response) {
    const text = await response.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { body = { message: text }; }
    if (!response.ok) throw new ApiError(response.status, body);
    return body;
}

function storeTokens(data) {
    session = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in || 0) * 1000,
        customerId: parseInt(data.username) || session?.customerId || null
    };
    saveJson(SESSION_KEY, session);
}

export async function login(username, password) {
    const response = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    if (response.status === 401) throw new ApiError(401, { message: 'Fel e-post eller lösenord' });
    const data = await parseResponse(response);
    storeTokens(data);
    await refreshBookings();
    notify();
    return session;
}

export function logout() {
    session = null;
    bookings = [];
    saveJson(SESSION_KEY, null);
    saveJson(BOOKINGS_KEY, null);
    push.sync([]).catch(() => {});
    notify();
}

export function getBookings() {
    return bookings;
}

async function refreshAccessToken() {
    const response = await fetch(OAUTH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: session.refreshToken })
    });
    const data = await parseResponse(response);
    storeTokens(data);
}

async function authFetch(path, options = {}) {
    if (!session) throw new ApiError(401, { message: 'Inte inloggad' });
    if (Date.now() > session.expiresAt - 60 * 1000) {
        try {
            await refreshAccessToken();
        } catch (e) {
            logout();
            throw new ApiError(401, { message: 'Sessionen har gått ut, logga in igen' });
        }
    }
    const response = await fetch(`${API}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.accessToken}`,
            ...(options.headers || {})
        }
    });
    if (response.status === 401) {
        logout();
        throw new ApiError(401, { message: 'Sessionen har gått ut, logga in igen' });
    }
    return parseResponse(response);
}

// Bookings are returned as {type: 'groupActivityBooking'|'waitingListBooking',
// groupActivity: {id}, groupActivityBooking|waitingListBooking: {id, waitingListPosition}, ...}
export async function refreshBookings() {
    if (!session) return [];
    const data = await authFetch(`/customers/${session.customerId}/bookings/groupactivities`);
    bookings = Array.isArray(data) ? data : [];
    saveJson(BOOKINGS_KEY, bookings);
    notify();
    push.sync(bookings).catch(e => console.warn('Reminder sync failed', e));
    return bookings;
}

// Returns the user's booking for a class id, or null
export function getBooking(activityId) {
    return bookings.find(b => b.groupActivity?.id === activityId) || null;
}

export function bookingInfo(activityId) {
    const b = getBooking(activityId);
    if (!b) return null;
    const waiting = b.type === 'waitingListBooking';
    return {
        waiting,
        position: waiting ? b.waitingListBooking?.waitingListPosition : null
    };
}

export async function book(activityId, allowWaitingList) {
    const result = await authFetch(`/customers/${session.customerId}/bookings/groupactivities`, {
        method: 'POST',
        body: JSON.stringify({ groupActivity: activityId, allowWaitingList })
    });
    await refreshBookings();
    return result;
}

// A cancel inside the late-cancellation window is refused with code
// LATE_CANCELLATION_CONSENT_REQUIRED until it is retried with allowLate=true.
// The API takes the arguments as query parameters, not a request body.
export async function cancel(activityId, allowLate = false) {
    const b = getBooking(activityId);
    if (!b) return;
    const bookingId = b.groupActivityBooking?.id || b.waitingListBooking?.id;
    const bookingType = b.type || (b.groupActivityBooking ? 'groupActivityBooking' : 'waitingListBooking');
    const params = new URLSearchParams({ bookingType });
    if (allowLate) params.set('allowLateCancellationWithNoShow', 'true');
    await authFetch(
        `/customers/${session.customerId}/bookings/groupactivities/${bookingId}?${params}`,
        { method: 'DELETE' }
    );
    await refreshBookings();
}
