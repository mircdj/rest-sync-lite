import { QueueManager } from '../queue/queue-manager';
import { NetworkWatcher } from '../network/watcher';
import { calculateBackoff } from '../utils/backoff';
import { EventEmitter } from '../utils/events';
import { RequestItem } from '../queue/types';

export interface SyncConfig {
    refreshToken?: () => Promise<void>;
    maxRetries?: number;
    backoffFactor?: number;
}

type SyncEvents = {
    'request-success': { id: string; response: any };
    'request-error': { id: string; error: any; permanent: boolean };
    'queue-empty': void;
};

export class SyncEngine {
    private queue: QueueManager;
    private network: NetworkWatcher;
    public events = new EventEmitter<SyncEvents>();
    private isSyncing = false;
    private config: SyncConfig;

    constructor(queue: QueueManager, network: NetworkWatcher, config: SyncConfig = {}) {
        this.queue = queue;
        this.network = network;
        this.config = config;

        // Listen for network becoming online to trigger sync
        this.network.onNetworkChange((isOnline) => {
            if (isOnline) {
                this.startSync();
            }
        });
    }

    async startSync() {
        if (this.isSyncing) return;
        if (!this.network.isOnline()) return;

        this.isSyncing = true;

        try {
            while (this.network.isOnline()) {
                const next = await this.queue.peekNextRequest();
                if (!next) {
                    this.events.emit('queue-empty', undefined);
                    break;
                }

                const { item, key } = next;

                try {
                    await this.processRequest(item);
                    // Success: remove from queue
                    await this.queue.dequeueRequest(key);
                    this.events.emit('request-success', { id: item.id, response: 'OK' });
                } catch (error: any) {
                    // Handle specific errors
                    if (error.status === 401 && this.config.refreshToken) {
                        // Token expired
                        console.log('Token expired, refreshing...');
                        try {
                            await this.config.refreshToken();
                            continue; // Retry same item immediately
                        } catch (refreshErr) {
                            console.error('Refresh token failed, marking request as permanent error:', item.id, refreshErr);
                            await this.queue.dequeueRequest(key);
                            this.events.emit('request-error', { id: item.id, error: refreshErr, permanent: true });
                            continue;
                        }
                    }

                    if (this.isPermanentError(error)) {
                        // Permanent error (400, 404, etc)
                        console.error('Permanent error, discarding request:', item.id, error);
                        await this.queue.dequeueRequest(key);
                        this.events.emit('request-error', { id: item.id, error, permanent: true });
                    } else {
                        // Transient error (5xx, Network)
                        item.retryCount = (item.retryCount || 0) + 1;
                        const maxRetries = this.config.maxRetries || 5;

                        if (item.retryCount > maxRetries) {
                            console.error(`Max retries (${maxRetries}) exceeded for request:`, item.id, error);
                            await this.queue.dequeueRequest(key);
                            this.events.emit('request-error', { id: item.id, error, permanent: true }); // Give up
                        } else {
                            // Transient error - Persist retry count
                            await this.queue.updateRequest(key, item);

                            const delay = calculateBackoff(item.retryCount, this.config.backoffFactor || 1000);
                            console.warn(`Transient error. Retrying in ${delay}ms...`, error);

                            // Wait before next loop iteration
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    }
                }
            }
        } finally {
            this.isSyncing = false;
        }
    }

    private async processRequest(item: RequestItem) {
        const response = await fetch(item.url, {
            method: item.method,
            headers: item.headers,
            body: typeof item.body === 'string' ? item.body : (item.body ? JSON.stringify(item.body) : undefined)
        });

        if (!response.ok) {
            throw { status: response.status, statusText: response.statusText };
        }
        return response;
    }

    private isPermanentError(error: any): boolean {
        if (error && typeof error.status === 'number') {
            return error.status >= 400 && error.status < 500 && error.status !== 401 && error.status !== 429;
        }
        return false; // Assume network errors/5xx are transient
    }
}
