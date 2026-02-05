# 🚀 rest-sync-lite

> **Zero-Dependency, Offline-First REST API Synchronization Engine.**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg)](https://www.typescriptlang.org/)

**rest-sync-lite** is a lightweight TypeScript library designed to make your web applications resilient to network issues. It intercepts API calls when the user is offline, persists them securely using IndexedDB, and automatically synchronizes them when the connection is restored.

Perfect for **Mobile Web Apps**, **PWAs**, **Field Service Apps**, and Enterprise Dashboards that cannot afford data loss.

---

## ✨ Key Features

*   📦 **Zero Runtime Dependencies:** Written in pure native TypeScript. No bloat (no `axios`, `lodash`, `idb`).
*   💾 **IndexedDB Powered:** Uses the browser's native database to store large queues that survive page refreshes or device restarts.
*   🔄 **FIFO Queue & Sequential Processing:** Guarantees that requests are executed strictly in the order they were created.
*   🛡️ **Smart Retry Policy:** Exponential backoff to handle server overloads (5xx) and intelligent handling of fatal errors (4xx).
*   🔐 **Auth-Aware:** Supports automatic session refreshing if a token expires (401) during synchronization.
*   🌐 **Framework Agnostic:** Works seamlessly with React, Angular, Vue, Svelte, or Vanilla JS.

---

## 📦 Installation

```bash
npm install rest-sync-lite
# or
yarn add rest-sync-lite
```

---

## 🚀 Quick Start

### 1. Initialization

Create a singleton instance of the library.

```typescript
import { RestSyncLite } from 'rest-sync-lite';

export const apiSync = new RestSyncLite({
  dbName: 'MyAppSyncDB',
  maxRetries: 3,
  // Optional: Function to refresh token if a 401 occurs during sync
  refreshToken: async () => {
    await myAuthService.refreshSession();
  }
});
```

### 2. Usage in your App

Replace your native `fetch` calls with `apiSync.fetch`. The signature is identical to `window.fetch`.

```typescript
// Example: Saving a form
async function saveOrder(orderData: any) {
  try {
    // This call will be queued if you are offline!
    // If offline, it returns a simulated 202 Accepted response.
    const response = await apiSync.fetch('https://api.example.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderData)
    });

    if (response.ok) {
        console.log('Order sent!');
    } else if (response.status === 202) {
        console.log('Order queued for background sync.');
    }
  } catch (error) {
    console.error('Request failed:', error);
  }
}
```

### 3. Events

You can force a synchronization manually if needed (e.g., when the user clicks a "Sync Now" button), although the library listens for online events automatically.

```typescript
await apiSync.syncNow();
```

---

## ⚙️ Configuration

The `RestSyncLite` constructor accepts a configuration object:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `dbName` | `string` | `'rest-sync-lite'` | The name of the IndexedDB database. |
| `maxRetries` | `number` | `5` | Max recursion attempts for 5xx/Network errors before giving up. |
| `refreshToken` | `() => Promise<void>` | `undefined` | Async callback to execute if the sync engine encounters a 401 error. |

---

## 🛠️ Architecture

**rest-sync-lite** acts as a proxy between your app and the network:

1.  **Intercept**: The request is analyzed.
2.  **Check**: If **ONLINE**, it attempts a direct send.
3.  **Fallback**: If **OFFLINE** or request fails (network error), it serializes the request.
4.  **Persist**: The serialized request is stored in IndexedDB (Object Store).
5.  **Sync**: A `NetworkWatcher` detects connection restoration and triggers the `SyncEngine`.
6.  **Process**: The engine processes the queue (FIFO), handles retries, and manages 401 token expiration loops.

---

## 🤝 Contributing

Pull Requests are welcome!

1.  Fork the repository
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License.