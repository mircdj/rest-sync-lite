import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDB, addItem, peekItem, removeItem, count, closeDB } from '../src/storage/db';
import 'fake-indexeddb/auto';

const DB_NAME = 'rest-sync-lite-test';
const STORE_NAME = 'requests';

describe('IndexedDB Storage', () => {
    // We rely on fake-indexeddb in-memory implementation which resets if we deal with it correctly
    // or we might need to delete DB between tests if it persists in the process memory.
    // For safety, let's try to delete the DB before each test.

    beforeEach(async () => {
        // Init a fresh DB usually
        await initDB(DB_NAME, STORE_NAME);
    });

    afterEach(async () => {
        // Reset or cleanup if possible. fake-indexeddb is in-memory but persists across tests in same process
        closeDB();
        const req = indexedDB.deleteDatabase(DB_NAME);
        await new Promise<void>((resolve, reject) => {
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    });

    it('should initialize and add items', async () => {
        const id = await addItem({ url: '/api/test' });
        expect(id).toBeDefined();

        const c = await count();
        expect(c).toBe(1);
    });

    it('should peek the first item (FIFO)', async () => {
        await addItem({ val: 1 });
        await addItem({ val: 2 });
        await addItem({ val: 3 });

        const first = await peekItem<{ val: number }>();
        expect(first).toBeDefined();
        expect(first?.value.val).toBe(1); // Oldest first
    });

    it('should remove items by id', async () => {
        const id = await addItem({ val: 1 });
        await removeItem(id);

        const c = await count();
        expect(c).toBe(0);

        const item = await peekItem();
        expect(item).toBeUndefined();
    });

    it('should handle complex objects', async () => {
        const data = {
            url: '/api/v1/users',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: 'John' }),
            timestamp: Date.now()
        };

        const id = await addItem(data);
        const stored = await peekItem<typeof data>();

        expect(stored?.value).toEqual(data);
        expect(stored?.id).toBe(id);
    });
});
