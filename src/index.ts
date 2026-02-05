import { QueueManager } from './queue/queue-manager';
import { NetworkWatcher } from './network/watcher';
import { SyncEngine, SyncConfig } from './engine/sync';

export interface RestSyncConfig extends SyncConfig {
    dbName?: string;
    networkWatcher?: NetworkWatcher;
}

export class RestSyncLite {
    private queue: QueueManager;
    private network: NetworkWatcher;
    private engine: SyncEngine;

    constructor(config: RestSyncConfig = {}) {
        this.queue = new QueueManager();
        this.network = config.networkWatcher || new NetworkWatcher();
        this.engine = new SyncEngine(this.queue, this.network, config);

        // Initialize DB mainly for side effects or ensure it's ready, 
        // though methods handle lazy init.
        this.queue.init().catch(err => console.error('Failed to init DB', err));
    }

    /**
     * Performs a fetch request. 
     * If offline or network fails, queues the request and returns a mock 202 response.
     */
    async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input.url;
        const method = init?.method?.toUpperCase() || 'GET';
        // We only queue mutating requests usually, but spec says "intercetta chiamate HTTP". 
        // Assuming we want to queue everything or maybe just non-GET? 
        // Standard offline-first often only queues mutations. 
        // For this exercise, let's queue everything if offline, but GETs might need data interaction.
        // The prompt says "intercetta chiamate HTTP... le salva... sincronizza". 
        // Usually implies mutations. If I queue a GET, I can't return data.
        // Let's assume generic proxy. If I queue, I return 202.

        if (this.network.isOnline()) {
            try {
                const response = await window.fetch(input, init);
                return response;
            } catch (err) {
                // Network error?
                console.warn('Network request failed, queueing...', err);
                return this.enqueueAndMock(url, method, init);
            }
        } else {
            return this.enqueueAndMock(url, method, init);
        }
    }

    private async enqueueAndMock(url: string, method: string, init?: RequestInit): Promise<Response> {
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

        // Read body
        let body: any = init?.body;
        // Ideally we should handle streams/blobs but for "Lite" assume JSON/Text string

        await this.queue.enqueueRequest({
            url,
            method: method as any,
            headers,
            body
        });

        return new Response(JSON.stringify({ status: 'queued', offline: true }), {
            status: 202,
            statusText: 'Accepted',
            headers: { 'Content-Type': 'application/json' }
        });
    }

    async syncNow() {
        return this.engine.startSync();
    }

    get syncEngine() {
        return this.engine;
    }
}

export * from './queue/types';
export * from './engine/sync';
