import { describe, it, expect, beforeEach } from 'vitest';
import { QueueManager } from '../src/queue/queue-manager';
import { deleteDB } from '../src/storage/db';

const DB_NAME = 'rest-sync-lite';

describe('QueueManager Priority', () => {
    let queue: QueueManager;

    beforeEach(async () => {
        await deleteDB(DB_NAME);
        queue = new QueueManager();
        await queue.init();
    });

    it('should return High priority items before Normal', async () => {
        await queue.enqueueRequest({ url: '/normal', method: 'GET', headers: {}, body: null, priority: 'normal' });
        await queue.enqueueRequest({ url: '/high', method: 'GET', headers: {}, body: null, priority: 'high' });

        const next = await queue.peekNextRequest();
        expect(next).toBeDefined();
        expect(next?.item.url).toBe('/high');
        expect(next?.item.priority).toBe('high');
    });

    it('should return Normal before Low', async () => {
        await queue.enqueueRequest({ url: '/low', method: 'GET', headers: {}, body: null, priority: 'low' });
        await queue.enqueueRequest({ url: '/normal', method: 'GET', headers: {}, body: null, priority: 'normal' });

        const next = await queue.peekNextRequest();
        expect(next?.item.url).toBe('/normal');
    });

    it('should respect FIFO within same priority', async () => {
        await queue.enqueueRequest({ url: '/high1', method: 'GET', headers: {}, body: null, priority: 'high' });
        await queue.enqueueRequest({ url: '/high2', method: 'GET', headers: {}, body: null, priority: 'high' });

        let next = await queue.peekNextRequest();
        expect(next?.item.url).toBe('/high1');

        // Dequeue to get next
        await queue.dequeueRequest(next!.key);

        next = await queue.peekNextRequest();
        expect(next?.item.url).toBe('/high2');
    });

    it('should fallback to Normal if no High', async () => {
        await queue.enqueueRequest({ url: '/normal', method: 'GET', headers: {}, body: null, priority: 'normal' });
        const next = await queue.peekNextRequest();
        expect(next?.item.url).toBe('/normal');
    });
});
