# 🚀 Release v1.3.0: PWA Superpowers 📡

We are thrilled to announce **v1.3.0**, a major update that brings **PWA Background Sync**, Priority Queues, and File Uploads to `rest-sync-lite`.

## ✨ New Features

### 📡 Background Sync API (PWA)
Your users can now close the browser while offline! `rest-sync-lite` integrates with the Service Worker to continue uploading data in the background as soon as connectivity is restored.
*   **Automatic Fallback:** Works seamlessly on supported browsers (Chrome/Edge/Android) and falls back to standard sync on others.
*   **Easy Integration:** Just one line in your `service-worker.js`: `initRestSyncServiceWorker()`.

### ⚡️ Priority Queue
Not all requests are equal. You can now tag requests as `high`, `normal`, or `low` priority.
```typescript
apiSync.fetch('/api/alert', { method: 'POST', priority: 'high' });
```

### 📂 File & Blob Support
Full support for `FormData`, `Blob`, and `File` uploads. The library handles serialization to IndexedDB automatically.
```typescript
const formData = new FormData();
formData.append('file', myFile);
apiSync.fetch('/upload', { method: 'POST', body: formData });
```

### 🚫 Request Cancellation
Need to stop a sync? You can now cancel requests by ID.
```typescript
apiSync.cancelRequest('my-custom-id');
```

## 📦 Upgrading
```bash
npm install rest-sync-lite@latest
```

## 🛠️ Internal Refactoring
*   `SyncEngine` is now environment-agnostic (Service Worker compatible).
*   Added `sw` entry point in build artifacts.
*   Expanded Unit Tests for all new features.

**Full Changelog**: https://github.com/mircdj/rest-sync-lite/compare/v1.2.0...v1.3.0
