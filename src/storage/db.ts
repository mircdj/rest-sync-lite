/**
 * Promisified IndexedDB Adapter for REST-Sync-Lite.
 * Zero requirements. Wraps native IndexedDB API.
 */

let dbInstance: IDBDatabase | null = null;
let currentStoreName: string = '';

/**
 * Initializes the IndexedDB database.
 * @param dbName Name of the database.
 * @param storeName Name of the object store.
 */
export function initDB(dbName: string, storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            return reject(new Error('indexedDB is not defined'));
        }

        // If already open with same name, reuse? 
        // For simplicity, if dbInstance exists, we assume it's good or we should check names.
        // Ideally we just return if already initialized to match this simple singleton pattern.
        if (dbInstance && dbInstance.name === dbName && dbInstance.objectStoreNames.contains(storeName)) {
            return resolve();
        }

        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { autoIncrement: true });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;
            currentStoreName = storeName;
            resolve();
        };

        request.onerror = (event) => {
            reject((event.target as IDBOpenDBRequest).error);
        };
    });
}

export function closeDB() {
    if (dbInstance) {
        dbInstance.close();
        dbInstance = null;
    }
}

/**
 * Adds an item to the store.
 * @param item The item to store.
 * @returns Promise resolving to the key of the inserted item.
 */
export function addItem<T>(item: T): Promise<IDBValidKey> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return reject(new Error('Database not initialized'));

        const transaction = dbInstance.transaction(currentStoreName, 'readwrite');
        const store = transaction.objectStore(currentStoreName);
        const request = store.add(item);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

/**
 * Peeks at the first item in the store (FIFO).
 * @returns Promise resolving to the first item (with its key) or undefined if empty.
 */
export function peekItem<T>(): Promise<{ id: IDBValidKey; value: T } | undefined> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return reject(new Error('Database not initialized'));

        const transaction = dbInstance.transaction(currentStoreName, 'readonly');
        const store = transaction.objectStore(currentStoreName);
        // Use a cursor to get just the first item
        const request = store.openCursor();

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                resolve({ id: cursor.key, value: cursor.value as T });
            } else {
                resolve(undefined);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Removes an item by its ID.
 * @param id The key of the item to remove.
 */
export function removeItem(id: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return reject(new Error('Database not initialized'));

        const transaction = dbInstance.transaction(currentStoreName, 'readwrite');
        const store = transaction.objectStore(currentStoreName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Counts the number of items in the store.
 * @returns Promise resolving to the count.
 */
export function count(): Promise<number> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return reject(new Error('Database not initialized'));

        const transaction = dbInstance.transaction(currentStoreName, 'readonly');
        const store = transaction.objectStore(currentStoreName);
        const request = store.count();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
