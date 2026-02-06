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

        const request = indexedDB.open(dbName, 2); // Bump version to 2 for priority index

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            let store: IDBObjectStore;

            if (!db.objectStoreNames.contains(storeName)) {
                store = db.createObjectStore(storeName, { autoIncrement: true });
            } else {
                store = (event.target as IDBOpenDBRequest).transaction!.objectStore(storeName);
            }

            if (!store.indexNames.contains('priority_idx')) {
                store.createIndex('priority_idx', 'priority', { unique: false });
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

export function updateItem<T>(key: IDBValidKey, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return reject(new Error('Database not initialized'));

        const transaction = dbInstance.transaction(currentStoreName, 'readwrite');
        const store = transaction.objectStore(currentStoreName);
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Peeks the first item matching a specific priority using the index.
 * @param priority The priority value to filter by ('high', 'normal', 'low').
 * @returns The first matching item or undefined.
 */
export function peekFirstByPriority<T>(priority: string): Promise<{ id: IDBValidKey; value: T } | undefined> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return reject(new Error('Database not initialized'));

        const transaction = dbInstance.transaction(currentStoreName, 'readonly');
        const store = transaction.objectStore(currentStoreName);
        if (!store.indexNames.contains('priority_idx')) {
            // Fallback if index doesn't exist yet (shouldn't happen after upgrade)
            return resolve(undefined);
        }
        const index = store.index('priority_idx');
        const request = index.openCursor(IDBKeyRange.only(priority));

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                resolve({ id: cursor.primaryKey, value: cursor.value as T });
            } else {
                resolve(undefined);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Removes an item where a specific field matches a value.
 * Uses a cursor to scan (inefficient for large datasets but fine for small queues without index).
 * @returns Promise resolving to true if removed, false if not found.
 */
export function removeByField(field: string, value: any): Promise<boolean> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return reject(new Error('Database not initialized'));

        const transaction = dbInstance.transaction(currentStoreName, 'readwrite');
        const store = transaction.objectStore(currentStoreName);
        const request = store.openCursor();
        let found = false;

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                if (cursor.value && cursor.value[field] === value) {
                    const deleteReq = cursor.delete();
                    deleteReq.onsuccess = () => {
                        found = true;
                        resolve(true);
                    };
                    deleteReq.onerror = () => reject(deleteReq.error);
                } else {
                    cursor.continue();
                }
            } else {
                resolve(found);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

/**
 * Clears all items from the store.
 */
export function clearStore(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return resolve(); // Or reject? For tests, resolve is fine if not init.

        const transaction = dbInstance.transaction(currentStoreName, 'readwrite');
        const store = transaction.objectStore(currentStoreName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

/**
 * Closes and deletes the database.
 */
export function deleteDB(dbName: string): Promise<void> {
    closeDB();
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') return resolve();
        const request = indexedDB.deleteDatabase(dbName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
    });
}

/**
 * Retrieves all items from the store.
 * @returns Promise resolving to an array of all items with their keys.
 */
export function getAllItems<T>(): Promise<{ id: IDBValidKey; value: T }[]> {
    return new Promise((resolve, reject) => {
        if (!dbInstance) return reject(new Error('Database not initialized'));

        const transaction = dbInstance.transaction(currentStoreName, 'readonly');
        const store = transaction.objectStore(currentStoreName);
        const request = store.openCursor();
        const results: { id: IDBValidKey; value: T }[] = [];

        request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (cursor) {
                results.push({ id: cursor.key, value: cursor.value as T });
                cursor.continue();
            } else {
                resolve(results);
            }
        };

        request.onerror = () => reject(request.error);
    });
}

