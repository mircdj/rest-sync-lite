import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncEngine } from '../src/engine/sync';
import { QueueManager } from '../src/queue/queue-manager';
import { NetworkWatcher } from '../src/network/watcher';
import { closeDB } from '../src/storage/db';
import 'fake-indexeddb/auto';

describe('SyncEngine', () => {
    let queue: QueueManager;
    let network: NetworkWatcher;
    let sync: SyncEngine;

    beforeEach(async () => {
        queue = new QueueManager();
        await queue.init();
        network = new NetworkWatcher();
        sync = new SyncEngine(queue, network);

        // Mock fetch globally
        global.fetch = vi.fn();
    });

    afterEach(async () => {
        closeDB();
        const req = indexedDB.deleteDatabase('rest-sync-lite');
        await new Promise<void>((resolve) => {
            req.onblocked = () => resolve(); // Ignore blocked
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
        vi.restoreAllMocks();
    });

    it('should process queue when online', async () => {
        // Enqueue item
        await queue.enqueueRequest({ url: '/api/success', method: 'POST', headers: {}, body: {} });

        // Mock successful fetch
        (global.fetch as any).mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({})
        });

        // Trigger sync
        await sync.startSync();

        // Queue should be empty
        const next = await queue.peekNextRequest();
        expect(next).toBeUndefined();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should remove item on permanent error (400)', async () => {
        await queue.enqueueRequest({ url: '/api/bad-request', method: 'POST', headers: {}, body: {} });

        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 400
        });

        await sync.startSync();

        const next = await queue.peekNextRequest();
        expect(next).toBeUndefined(); // Removed
    });

    it('should not double-encode body if already string', async () => {
        const payload = JSON.stringify({ key: 'value' });
        await queue.enqueueRequest({
            url: '/api/string-body',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Simulate what happens when main.ts passes a stringified body
            body: payload as any
        });

        // Mock fetch to capture the body sent
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({})
        });
        global.fetch = fetchMock;

        await sync.startSync();

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const callArgs = fetchMock.mock.calls[0];
        const init = callArgs[1] as RequestInit;

        // Body should exactly match the input payload (not double stringified)
        expect(init.body).toBe(payload);
    });

    // Note: Testing transient error wait times might be slow, mocking timers recommended for full suite
});
