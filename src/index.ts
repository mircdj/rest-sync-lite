import { QueueManager } from './queue/queue-manager';
import { NetworkWatcher } from './network/watcher';
import { EventEmitter } from './utils/events';
import { SyncEngine } from './engine/sync';
import type { SyncConfig } from './engine/sync';

export interface RestSyncConfig extends SyncConfig {
    dbName?: string;
    networkWatcher?: NetworkWatcher;
}

type RestSyncEvents = {
    'network:change': boolean;
    'queue:update': void;
    'sync:start': void;
    'sync:end': void;
    // Forwarded from engine but maybe not critical for hook? 
    // User requested specifically those 4 above to be emitted.
    // But hooks might want errors too. For now let's stick to the list.
    'request-success': { id: string; response: any };
    'request-error': { id: string; error: any; permanent: boolean };
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
    async fetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
        const url = typeof input === 'string' ? input : input.url;
        const method = init?.method?.toUpperCase() || 'GET';

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
