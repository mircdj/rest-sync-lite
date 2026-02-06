import { initRestSyncServiceWorker } from 'rest-sync-lite/sw';

// Initialize the background sync listener
initRestSyncServiceWorker({
    maxRetries: 5,
    refreshToken: async () => {
        console.log('[SW] Refreshing token (mock)...');
    }
});

self.addEventListener('install', () => {
    console.log('[SW] Installed');
    (self as any).skipWaiting();
});

self.addEventListener('activate', (event: any) => {
    console.log('[SW] Activated');
    event.waitUntil((self as any).clients.claim());
});
