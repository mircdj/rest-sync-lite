import { QueueManager } from '../queue/queue-manager';
import { SyncEngine, type SyncConfig } from '../engine/sync';
import { NetworkWatcher } from '../network/watcher';

/**
 * Initializes the REST-Sync-Lite Service Worker handler.
 * Call this function at the top level of your service-worker.js
 */
export function initRestSyncServiceWorker(config: SyncConfig = {}) {
    // @ts-ignore - ServiceWorkerGlobalScope type issues in some setups
    self.addEventListener('sync', (event: any) => {
        if (event.tag === 'rest-sync-queue') {
            console.log('[RestSyncLite] Background Sync triggered');
            event.waitUntil(processQueueInBackground(config));
        }
    });
}

async function processQueueInBackground(config: SyncConfig) {
    const queue = new QueueManager();
    const network = new NetworkWatcher();

    // Force online state check since we are in SW and 'sync' event implies connectivity
    // But NetworkWatcher should detect it via navigator.onLine

    const engine = new SyncEngine(queue, network, config);

    // Monitor events just for logging
    engine.events.on('request-success', ({ id }) => console.log(`[RestSyncLite] BG Sync: Request ${id} success`));
    engine.events.on('request-error', ({ id, error }) => console.error(`[RestSyncLite] BG Sync: Request ${id} failed`, error));

    await queue.init();
    await engine.startSync();
}
