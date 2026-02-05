import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { QueueManager } from '../src/queue/queue-manager';
import { closeDB } from '../src/storage/db';
import 'fake-indexeddb/auto';

describe('QueueManager', () => {
    let queue: QueueManager;

    beforeEach(async () => {
        queue = new QueueManager();
        await queue.init();
    });

    afterEach(async () => {
        // Close connection before deleting!
        closeDB();

        const req = indexedDB.deleteDatabase('rest-sync-lite');
        await new Promise<void>((resolve, reject) => {
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
            req.onblocked = () => { console.warn('DB delete blocked'); };
        });
    });

    it('should enqueue items and assign IDs', async () => {
        const id = await queue.enqueueRequest({
            url: '/test',
            method: 'POST',
            headers: {},
            body: {}
        });

        expect(id).toBeDefined();

        const next = await queue.peekNextRequest();
        expect(next).toBeDefined();
        expect(next?.item.id).toBe(id);
        expect(next?.item.timestamp).toBeDefined();
        expect(next?.item.retryCount).toBe(0);
    });

    it('should process items in FIFO order', async () => {
        await queue.enqueueRequest({ url: '/first', method: 'POST', headers: {}, body: {} });
        await queue.enqueueRequest({ url: '/second', method: 'POST', headers: {}, body: {} });

        const first = await queue.peekNextRequest();
        expect(first?.item.url).toBe('/first');

        // Remove first
        if (first) await queue.dequeueRequest(first.key);

        const second = await queue.peekNextRequest();
        expect(second?.item.url).toBe('/second');
    });

    it('should maintain FIFO order with multiple items', async () => {
        const items = ['req1', 'req2', 'req3', 'req4', 'req5'];

        // Enqueue all
        for (const url of items) {
            await queue.enqueueRequest({ url, method: 'POST', headers: {}, body: null });
        }

        // Dequeue and verify order
        for (const expectedUrl of items) {
            const next = await queue.peekNextRequest();
            expect(next).toBeDefined();
            expect(next?.item.url).toBe(expectedUrl);
            if (next) await queue.dequeueRequest(next.key);
        }

        const final = await queue.peekNextRequest();
        expect(final).toBeUndefined();
    });
});
