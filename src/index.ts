import { serializeBody } from './utils/serializer';
import { EventEmitter } from './utils/events';
import { SyncEngine } from './engine/sync';
import type { SyncConfig } from './engine/sync';
import { QueueManager } from './queue/queue-manager';
import { NetworkWatcher } from './network/watcher';

import type { Priority, RequestItem } from './queue/types';

// Omit 'priority' from RequestInit because it conflicts with our custom Priority type
// (Native priority is 'high' | 'low' | 'auto', ours is 'high' | 'normal' | 'low')
export interface RestSyncRequestInit extends Omit<RequestInit, 'priority'> {
    priority?: Priority;
    id?: string;
}

export interface RestSyncConfig extends SyncConfig {
    dbName?: string;
    networkWatcher?: NetworkWatcher;
}

type RestSyncEvents = {
    'network:change': boolean;
    'queue:update': void;
    'sync:start': void;
    'sync:end': void;
    'request-success': { id: string; response: any; item: RequestItem };
    'request-error': { id: string; error: any; permanent: boolean; item: RequestItem };
    'request:cancelled': string;
};

export class RestSyncLite {
    private queue: QueueManager;
    private network: NetworkWatcher;
    private engine: SyncEngine;
    public events = new EventEmitter<RestSyncEvents>();

    constructor(config: RestSyncConfig = {}) {
        this.queue = new QueueManager();
        this.network = config.networkWatcher || new NetworkWatcher();
        this.engine = new SyncEngine(this.queue, this.network, config);

        // Initialize DB
        this.queue.init().catch(err => console.error('Failed to init DB', err));

        // Wire up events
        this.network.onNetworkChange((isOnline) => {
            this.events.emit('network:change', isOnline);
        });

        this.queue.events.on('queue:update', () => {
            this.events.emit('queue:update', undefined);
        });

        this.engine.events.on('sync:start', () => this.events.emit('sync:start', undefined));
        this.engine.events.on('sync:end', () => this.events.emit('sync:end', undefined));
        this.engine.events.on('request-success', (p) => this.events.emit('request-success', p));
        this.engine.events.on('request-error', (p) => this.events.emit('request-error', p));
    }

    // --- Public Getters for Hook ---
    get isOnline(): boolean {
        return this.network.isOnline();
    }

    get isSyncing(): boolean {
        return this.engine.isSyncing;
    }

    get queueSize(): number {
        return this.queue.size;
    }

    /**
     * Performs a fetch request. 
     * If offline or network fails, queues the request and returns a mock 202 response.
     */
    async fetch(input: RequestInfo, init?: RestSyncRequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input.url;
        const method = init?.method?.toUpperCase() || 'GET';

        // 1. ESTRAZIONE: Separiamo le nostre proprietà da quelle standard
        // Destrutturiamo 'priority' e 'id' per evitare che finiscano nella fetch nativa
        const { priority, id, ...standardInit } = init || {};

        if (this.network.isOnline()) {
            try {
                // We pass only the standard properties to the native fetch
                const response = await window.fetch(input, standardInit);

                // Server errors (5xx) still require queuing
                if (response.status >= 500) {
                    return this.enqueueAndMock(url, method, init);
                }

                return response;
            } catch (err) {
                // Network error (e.g. timeout or DNS failed)
                console.warn('Network request failed, queueing...', err);
                return this.enqueueAndMock(url, method, init);
            }
        } else {
            return this.enqueueAndMock(url, method, init);
        }
    }

    private async enqueueAndMock(url: string, method: string, init?: RestSyncRequestInit): Promise<Response> {
        // Normalize headers
        const headers: Record<string, string> = {};
        if (init?.headers) {
            if (init.headers instanceof Headers) {
                init.headers.forEach((v, k) => headers[k] = v);
            } else if (Array.isArray(init.headers)) {
                init.headers.forEach(([k, v]) => headers[k] = v);
            } else {
                Object.assign(headers, init.headers);
            }
        }

        // Read body and serialize
        const body = serializeBody(init?.body);

        // Queue request
        const id = await this.queue.enqueueRequest({
            url,
            method: method as any,
            headers,
            body,
            priority: init?.priority,
            id: init?.id
        });

        // Register Background Sync if supported and we are offline (or just always to be safe)
        if ('serviceWorker' in navigator && 'SyncManager' in window && !this.network.isOnline()) {
            try {
                const registration = await navigator.serviceWorker.ready;
                // @ts-ignore - SyncManager is not yet in all TS libs standard
                await registration.sync.register('rest-sync-queue');
            } catch (err) {
                console.warn('Background Sync registration failed:', err);
            }
        }

        return new Response(JSON.stringify({ status: 'queued', offline: true, id }), {
            status: 202,
            statusText: 'Accepted',
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async syncNow() {
        return this.engine.startSync();
    }

    /**
     * Cancels a specific request by its ID.
     * @param requestId The UUID of the request to cancel.
     */
    async cancelRequest(requestId: string): Promise<boolean> {
        const result = await this.queue.cancelRequest(requestId);
        if (result) {
            this.events.emit('request:cancelled', requestId);
        }
        return result;
    }

    /**
     * Returns all items currently in the queue.
     * Useful for UI visualization of pending requests.
     */
    async getQueueItems() {
        return this.queue.getAllItems();
    }

    /**
     * Manually forces the library to behave as if offline.
     * Useful for "Data Saver" modes or testing.
     * @param enabled If true, forces offline mode. If false, restores real network state.
     */
    setOfflineMode(enabled: boolean) {
        this.network.setOfflineMode(enabled);
    }

    get syncEngine() {
        return this.engine;
    }
}

export * from './queue/types';
export * from './engine/sync';

