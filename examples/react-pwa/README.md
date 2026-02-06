# React PWA Example

This folder demonstrates how to integrate `rest-sync-lite` into a React application with Service Worker support.

## Setup

1.  **Install dependencies:**
    ```bash
    npm install rest-sync-lite
    ```

2.  **Service Worker (`sw.ts`):**
    ```typescript
    import { initRestSyncServiceWorker } from 'rest-sync-lite/sw';

    // Auto-process queue in background
    initRestSyncServiceWorker();
    ```

3.  **App Component:**
    ```tsx
    import { RestSyncLite } from 'rest-sync-lite';
    import { useRestSync } from 'rest-sync-lite/react';

    const api = new RestSyncLite();

    export function App() {
        const { isOnline, queueSize } = useRestSync(api);
        
        return (
            <div>
                <h1>Status: {isOnline ? 'Online' : 'Offline'}</h1>
                <p>Pending: {queueSize}</p>
            </div>
        );
    }
    ```
