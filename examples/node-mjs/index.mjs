import { RestSyncLite } from 'rest-sync-lite';
// Note: In Node.js, IndexedDB is not available natively.
// You must provide a mock or use 'fake-indexeddb' globally.
import 'fake-indexeddb/auto';

// Global fetch is required (Node 18+)
if (!globalThis.fetch) {
    throw new Error('Node 18+ required for fetch');
}

async function main() {
    const api = new RestSyncLite({
        dbName: 'NodeSyncDB'
    });

    console.log('Sending request from Node...');

    const res = await api.fetch('https://jsonplaceholder.typicode.com/todos/1', {
        method: 'GET'
    });

    const data = await res.json();
    console.log('Data:', data);
}

main().catch(console.error);
