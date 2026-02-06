import { describe, it, expect, beforeEach } from 'vitest';
import { QueueManager } from '../src/queue/queue-manager';
import { deleteDB } from '../src/storage/db';

const DB_NAME = 'rest-sync-lite';

describe('QueueManager Cancellation', () => {
    let queue: QueueManager;

    beforeEach(async () => {
        await deleteDB(DB_NAME);
        queue = new QueueManager();
        await queue.init();
    });

    it('should cancel a request by ID', async () => {
        const id = await queue.enqueueRequest({ url: '/cancel-me', method: 'GET', headers: {}, body: null });

        // Confirm it's there
        let next = await queue.peekNextRequest();
        expect(next?.item.id).toBe(id);

        // Cancel
        const result = await queue.cancelRequest(id);
        expect(result).toBe(true);

        // Confirm it's gone
        next = await queue.peekNextRequest();
        expect(next).toBeUndefined();
    });

    it('should return false if cancelling non-existent ID', async () => {
        const result = await queue.cancelRequest('non-existent');
        expect(result).toBe(false);
    });

    it('should allow custom ID and cancel by it', async () => {
        const customId = 'custom-123';
        await queue.enqueueRequest({ url: '/custom', method: 'GET', headers: {}, body: null, id: customId });

        const result = await queue.cancelRequest(customId);
        expect(result).toBe(true);
        expect(await queue.peekNextRequest()).toBeUndefined();
    });
});
