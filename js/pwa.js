// Registers the service worker. The scope is relative so the app works both
// under a subpath (GitHub Pages /isabelle/) and at a domain root.
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => {
            console.warn('Service worker registration failed', err);
        });
    });
}
