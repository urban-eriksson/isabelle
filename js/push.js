// Anonymous push reminders. The push subscription is the only identity the
// reminder server knows; it receives the user's upcoming bookings (class,
// time, gym, instructor) so a morning job can push "Du har Yoga idag 17:00".
import { findCachedActivity } from './api.js';

// Same-origin behind CloudFront in production; a local uvicorn during development.
const API_BASE = location.hostname.endsWith('korist.se') ? '/api' : 'http://localhost:8001/api';
const ENABLED_KEY = 'pushEnabled';

let serverKey;  // undefined = not checked yet, null = push not available

export function isEnabled() {
    return localStorage.getItem(ENABLED_KEY) === 'on';
}

export function isSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Resolves to the VAPID public key, or null when there is no reminder server
export async function available() {
    if (!isSupported()) return null;
    if (serverKey !== undefined) return serverKey;
    try {
        const response = await fetch(`${API_BASE}/push/key`);
        serverKey = response.ok ? (await response.json()).key : null;
    } catch (e) {
        serverKey = null;
    }
    return serverKey;
}

function base64UrlToUint8Array(s) {
    const padding = '='.repeat((4 - s.length % 4) % 4);
    const raw = atob((s + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
}

async function getSubscription() {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
}

export async function enable(bookings) {
    const key = await available();
    if (!key) throw new Error('Påminnelser är inte tillgängliga');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Du behöver tillåta notiser i webbläsaren');
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
        subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: base64UrlToUint8Array(key)
        });
    }
    localStorage.setItem(ENABLED_KEY, 'on');
    await sync(bookings);
}

export async function disable() {
    localStorage.setItem(ENABLED_KEY, 'off');
    const subscription = await getSubscription();
    if (!subscription) return;
    try {
        await fetch(`${API_BASE}/subscriptions`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint })
        });
    } finally {
        await subscription.unsubscribe();
    }
}

// Converts Friskis bookings to the minimal shape the reminder server stores
function toReminderBookings(bookings) {
    return bookings.map(b => {
        const activity = b.groupActivity || {};
        const cached = findCachedActivity(activity.id);
        const start = b.duration?.start || cached?.duration?.start;
        if (!activity.id || !start) return null;
        return {
            id: activity.id,
            businessUnitId: activity.businessUnit?.id || cached?.businessUnit?.id || null,
            activity: activity.name || cached?.name || 'pass',
            start,
            location: (activity.businessUnit?.name || cached?.businessUnit?.name || '').replace('Stockholm -', '').trim(),
            instructor: (activity.instructors || cached?.instructors || [])[0]?.name || '',
            waiting: b.type === 'waitingListBooking'
        };
    }).filter(Boolean);
}

// Sends the current bookings to the reminder server (no-op unless enabled)
export async function sync(bookings) {
    if (!isEnabled()) return;
    const subscription = await getSubscription();
    if (!subscription) return;
    const json = subscription.toJSON();
    await fetch(`${API_BASE}/subscriptions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            endpoint: json.endpoint,
            keys: json.keys,
            bookings: toReminderBookings(bookings)
        })
    });
}
