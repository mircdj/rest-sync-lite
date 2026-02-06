/**
 * Prepares the request body for storage in IndexedDB.
 * Strings, Blobs, ArrayBuffers, and FormData can store directly in modern IDB.
 * Plain objects should be JSON stringified to ensure reconstruction is expected
 * (or kept as objects if we want structural clone, but fetch expects BodyInit).
 * 
 * However, we want to reconstruct `RequestInit` from this.
 * If we store `{ foo: 'bar' }` as object, when we do `fetch(url, { body: object })` it [object Object].
 * So plain objects MUST be stringified if intended as JSON.
 *
 * Blobs and FormData should be kept as is.
 */
export function serializeBody(body: any): any {
    if (!body) return null;

    if (typeof body === 'string') return body;
    if (body instanceof Blob) return body;
    if (body instanceof ArrayBuffer) return body;
    if (body instanceof FormData) return body;
    if (body instanceof URLSearchParams) return body;

    // If it's a plain object (and not one of the above), we likely sent a JSON body
    // and ideally headers has Content-Type: application/json.
    // We stringify it here to ensure it's ready for fetch.
    return JSON.stringify(body);
}
