import { initDB, addItem, peekItem, removeItem, updateItem, count } from '../storage/db';
import { generateUUID } from '../utils/uuid';
import { EventEmitter } from '../utils/events';
import type { RequestItem } from './types';

const DB_NAME = 'rest-sync-lite';
const STORE_NAME = 'request-queue';

type QueueEvents = {
    'queue:update': void;
};

export class QueueManager {
    private initialized: Promise<void> | null = null;
    private _queueSize: number = 0;
    public events = new EventEmitter<QueueEvents>();

    /**
     * Ensures the database is initialized.
     */
    async init(): Promise<void> {
        if (!this.initialized) {
            this.initialized = initDB(DB_NAME, STORE_NAME).then(async () => {
                this._queueSize = await count();
                this.events.emit('queue:update', undefined);
            });
        }
        return this.initialized;
    }

    get size(): number {
        return this._queueSize;
    }

    /**
     * Adds a new request to the queue.
     * @param request The request details (excluding managed fields like id, timestamp, retryCount).
     * @returns The generated ID of the queued request.
     */
    async enqueueRequest(
        request: Omit<RequestItem, 'id' | 'timestamp' | 'retryCount'>
    ): Promise<string> {
        await this.init();

        const id = generateUUID();
        const item: RequestItem = {
            ...request,
            id,
            timestamp: Date.now(),
            retryCount: 0,
        };

        await addItem(item);
        this._queueSize++; // Optimistic update
        this.events.emit('queue:update', undefined);
        return id;
    }

    /**
     * Peeks the next request in the FIFO queue.
     * @returns The request item and its internal storage key, or undefined if empty.
     */
    async peekNextRequest(): Promise<{ item: RequestItem; key: IDBValidKey } | undefined> {
        await this.init();
        const result = await peekItem<RequestItem>();

        if (!result) return undefined;

        return {
            item: result.value,
            key: result.id,
        };
    }

    /**
     * Removes a request from the queue by its storage key.
     * @param key The internal storage key returned by peekNextRequest.
     */
    async dequeueRequest(key: IDBValidKey): Promise<void> {
        await this.init();
        await removeItem(key);
        this._queueSize = Math.max(0, this._queueSize - 1);
        this.events.emit('queue:update', undefined);
    }

    async updateRequest(key: IDBValidKey, item: RequestItem): Promise<void> {
        await this.init();
        await updateItem(key, item);
    }
}
