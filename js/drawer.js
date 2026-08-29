import * as friskis from './friskis.js';
import * as push from './push.js';
import { invalidateGym } from './api.js';

const days = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
const months = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const pad = n => String(n).padStart(2, '0');
const time = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const longDate = d => `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;

let drawer, backdrop, content;
let current = null;  // the item currently shown
let busy = false;
let error = '';
let needsLateConsent = false;  // cancel was refused pending late-cancellation consent

const ERROR_TEXTS = {
    TOO_LATE_TO_CANCEL: 'Det är för sent att avboka det här passet.',
    TOO_LATE_TO_CANCEL_RULE: 'Det är för sent att avboka det här passet.',
    TOO_LATE_TO_BOOK: 'Bokningen har stängt för det här passet.',
    TOO_EARLY_TO_BOOK: 'Bokningen har inte öppnat ännu.',
    ALREADY_BOOKED: 'Du är redan bokad på passet.',
};

export function initDrawer() {
    drawer = document.getElementById('drawer');
    backdrop = document.getElementById('drawer-backdrop');
    content = document.getElementById('drawer-content');
    backdrop.addEventListener('click', closeDrawer);
    friskis.onChange(() => { if (current) render(); });
}

export function openDrawer(item) {
    current = item;
    error = '';
    needsLateConsent = false;
    render();
    drawer.classList.add('open');
    backdrop.classList.add('open');
}

export function closeDrawer() {
    drawer.classList.remove('open');
    backdrop.classList.remove('open');
    current = null;
}

// Opens the drawer with only the login form (used from the header icon)
export function openLogin() {
    current = { loginOnly: true };
    error = '';
    render();
    drawer.classList.add('open');
    backdrop.classList.add('open');
}

function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function render() {
    content.innerHTML = '';
    if (current.loginOnly) {
        content.appendChild(el('h2', 'drawer-title', 'Mitt Friskis'));
        if (friskis.isLoggedIn()) {
            content.appendChild(el('p', 'drawer-line', 'Du är inloggad.'));
            content.appendChild(reminderToggle());
            if (error) content.appendChild(el('p', 'drawer-error', error));
            const btn = el('button', 'drawer-btn secondary', 'Logga ut');
            btn.addEventListener('click', () => { friskis.logout(); closeDrawer(); });
            content.appendChild(btn);
        } else {
            if (error) content.appendChild(el('p', 'drawer-error', error));
            content.appendChild(loginForm());
        }
        return;
    }

    const item = current;
    content.appendChild(el('h2', 'drawer-title', item.activity));

    const addLine = (icon, text) => {
        const line = el('p', 'drawer-line');
        const i = el('i', `fas ${icon}`);
        line.appendChild(i);
        line.appendChild(document.createTextNode(' ' + text));
        content.appendChild(line);
    };

    addLine('fa-clock', `${longDate(item.date)} ${time(item.date)}–${time(item.endDate)}`);
    addLine('fa-map-marker-alt', item.room ? `${item.location.trim()}, ${item.room}` : item.location.trim());
    addLine('fa-user', item.instructors.length ? item.instructors.join(', ') : '---');
    if (item.message) addLine('fa-info-circle', item.message);

    if (item.cancelled) {
        addLine('fa-ban', 'Passet är inställt');
    } else if (item.status === 'dropin') {
        addLine('fa-users', `Endast drop-in (${item.dropinSpots} platser)`);
    } else if (item.total !== null) {
        let text = `${item.booked} av ${item.total} platser bokade`;
        if (item.leftToBook > 0) text += `, ${item.leftToBook} kvar`;
        else if (item.hasWaitingList) text += `, fullt – ${item.inWaitingList} i kö`;
        else text += ', fullt';
        addLine('fa-users', text);
    }

    const now = new Date();
    const booking = friskis.bookingInfo(item.id);
    if (booking) {
        addLine('fa-check-circle', booking.waiting
            ? `Du står i kö${booking.position ? ` (plats ${booking.position})` : ''}`
            : 'Du är bokad på passet');
    }

    if (error) content.appendChild(el('p', 'drawer-error', error));

    if (!friskis.isLoggedIn()) {
        content.appendChild(el('p', 'drawer-hint', 'Logga in på Mitt Friskis för att boka.'));
        content.appendChild(loginForm());
        return;
    }

    // After a booking change the gym's spots-left numbers are stale: drop that
    // gym from the cache and have the table re-render with fresh data.
    const act = fn => run(async () => {
        await fn();
        invalidateGym(item.businessUnitId);
        document.dispatchEvent(new Event('refresh-table'));
    });

    const actions = el('div', 'drawer-actions');
    if (booking && needsLateConsent) {
        actions.appendChild(el('p', 'drawer-hint',
            'Sen avbokning: passet är nära i tid, så avbokningen räknas som "no show". Vill du avboka ändå?'));
        const btn = el('button', 'drawer-btn danger', 'Avboka ändå');
        btn.disabled = busy;
        btn.addEventListener('click', () => {
            needsLateConsent = false;
            act(() => friskis.cancel(item.id, true));
        });
        actions.appendChild(btn);
    } else if (booking) {
        const btn = el('button', 'drawer-btn danger', booking.waiting ? 'Lämna kön' : 'Avboka');
        btn.disabled = busy;
        btn.addEventListener('click', () => act(() => friskis.cancel(item.id)));
        actions.appendChild(btn);
    } else if (item.cancelled || item.status === 'dropin') {
        // nothing to book
    } else if (item.bookableEarliest && now < item.bookableEarliest) {
        actions.appendChild(el('p', 'drawer-hint', `Bokningen öppnar ${longDate(item.bookableEarliest)} ${time(item.bookableEarliest)}`));
    } else if (item.bookableLatest && now > item.bookableLatest) {
        actions.appendChild(el('p', 'drawer-hint', 'Bokningen har stängt'));
    } else if (item.leftToBook > 0) {
        const btn = el('button', 'drawer-btn primary', 'Boka');
        btn.disabled = busy;
        btn.addEventListener('click', () => act(() => friskis.book(item.id, false)));
        actions.appendChild(btn);
    } else if (item.hasWaitingList) {
        const btn = el('button', 'drawer-btn primary', 'Ställ i kö');
        btn.disabled = busy;
        btn.addEventListener('click', () => act(() => friskis.book(item.id, true)));
        actions.appendChild(btn);
    } else {
        actions.appendChild(el('p', 'drawer-hint', 'Passet är fullbokat'));
    }
    content.appendChild(actions);
}

async function run(action) {
    busy = true;
    error = '';
    render();
    try {
        await action();
    } catch (e) {
        if (e.code === 'LATE_CANCELLATION_CONSENT_REQUIRED') {
            needsLateConsent = true;
        } else {
            error = ERROR_TEXTS[e.code] || e.message || 'Något gick fel';
        }
    } finally {
        busy = false;
        render();
    }
}

// Checkbox for the morning reminders; hidden until we know a reminder server exists
function reminderToggle() {
    const wrap = el('div', 'reminder-toggle');
    wrap.hidden = true;
    const label = el('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = push.isEnabled();
    box.disabled = busy;
    label.appendChild(box);
    label.appendChild(document.createTextNode(' Påminn mig kl 05:00 om dagens bokade pass'));
    wrap.appendChild(label);
    wrap.appendChild(el('p', 'drawer-hint', 'Skickas som notis till den här enheten.'));
    box.addEventListener('change', () => {
        run(() => box.checked ? push.enable(friskis.getBookings()) : push.disable());
    });
    push.available().then(key => { if (key && current?.loginOnly) wrap.hidden = false; });
    return wrap;
}

function loginForm() {
    const form = el('form', 'login-form');
    form.innerHTML = `
        <input type="email" name="username" placeholder="E-post" autocomplete="username" required>
        <input type="password" name="password" placeholder="Lösenord" autocomplete="current-password" required>
        <button type="submit" class="drawer-btn primary">Logga in</button>
        <p class="drawer-hint">Samma inloggning som på Mitt Friskis. Uppgifterna sparas bara i din webbläsare.</p>
    `;
    form.addEventListener('submit', async event => {
        event.preventDefault();
        const username = form.username.value.trim();
        const password = form.password.value;
        await run(() => friskis.login(username, password));
    });
    return form;
}
