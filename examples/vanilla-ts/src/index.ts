import { RestSyncLite } from 'rest-sync-lite';

// 1. Initialize
const api = new RestSyncLite({
    dbName: 'VanillaDB',
    maxRetries: 3
});

const statusEl = document.getElementById('status')!;
const uploadForm = document.getElementById('upload-form') as HTMLFormElement;

// 2. Monitor Network
api.syncEngine.events.on('sync:start', () => {
    statusEl.textContent = 'Syncing...';
});
api.syncEngine.events.on('queue-empty', () => {
    statusEl.textContent = 'All synced!';
});

// 3. Handle Form Submit (File Upload)
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(uploadForm);

    // Explicitly set priority
    const priority = formData.get('urgent') ? 'high' : 'normal';

    try {
        const res = await api.fetch('/api/upload', {
            method: 'POST',
            body: formData,
            priority: priority as any
        });

        if (res.status === 202) {
            alert('Offline! Request queued.');
        } else {
            alert('Uploaded successfully!');
        }
    } catch (err) {
        console.error(err);
    }
});
