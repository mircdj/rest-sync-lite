import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RestSyncLite } from '../src/index';
import { closeDB } from '../src/storage/db';
import { NetworkWatcher } from '../src/network/watcher';
import 'fake-indexeddb/auto';

describe('RestSyncLite E2E', () => {
    let app: RestSyncLite;
    let mockWatcher: NetworkWatcher;

    beforeEach(() => {
        global.fetch = vi.fn();
        mockWatcher = new NetworkWatcher();
    });

    afterEach(async () => {
        closeDB();
        const req = indexedDB.deleteDatabase('rest-sync-lite');
        await new Promise<void>((resolve) => {
            req.onblocked = () => resolve();
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
        });
        vi.restoreAllMocks();
    });

    it('should pass through fetch when online', async () => {
        vi.spyOn(mockWatcher, 'isOnline').mockReturnValue(true);
        app = new RestSyncLite({ networkWatcher: mockWatcher }); // Inject

        (global.fetch as any).mockResolvedValue(new Response('ok', { status: 200 }));

        const res = await app.fetch('/api/live');
        expect(res.status).toBe(200);
        expect(global.fetch).toHaveBeenCalled();
    });

    it('should queue request when offline', async () => {
        vi.spyOn(mockWatcher, 'isOnline').mockReturnValue(false);
        app = new RestSyncLite({ networkWatcher: mockWatcher });

        const res = await app.fetch('/api/offline', {
            method: 'POST',
            body: JSON.stringify({ data: 1 })
        });

        // Should return 202 Mock
        expect(res.status).toBe(202);
        expect(global.fetch).not.toHaveBeenCalled();

        // Mock successful fetch for sync
        (global.fetch as any).mockResolvedValue(new Response('synced', { status: 201 }));

        // Go Online simulation
        vi.spyOn(mockWatcher, 'isOnline').mockReturnValue(true);
        // We need to trigger listener manually since we mocked the class method but not the event emission logic inside if we use the real class.
        // But since we injected it, we can emit event if we access it? 
        // NetworkWatcher has private event emitter.
        // We can just call syncNow manually as in requirements.

        await app.syncNow();

        expect(global.fetch).toHaveBeenCalledWith('/api/offline', expect.objectContaining({
            method: 'POST'
        }));
    });
});
