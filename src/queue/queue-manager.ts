import { initDB, addItem, peekItem, removeItem, updateItem } from '../storage/db';
import { generateUUID } from '../utils/uuid';
import { RequestItem } from './types';

const DB_NAME = 'rest-sync-lite';
const STORE_NAME = 'request-queue';

export class QueueManager {
    private initialized: Promise<void> | null = null;

    /**
     * Ensures the database is initialized.
     */
    async init(): Promise<void> {
        if (!this.initialized) {
            this.initialized = initDB(DB_NAME, STORE_NAME);
        }
        return this.initialized;
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
    }

    async updateRequest(key: IDBValidKey, item: RequestItem): Promise<void> {
        await this.init();
        await updateItem(key, item);
    }
}
