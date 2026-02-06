export type RequestBody = string | Blob | ArrayBuffer | FormData | URLSearchParams | Record<string, any> | null;

export type Priority = 'high' | 'normal' | 'low';

export interface RequestItem {
    id: string;
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers: Record<string, string>;
    body: RequestBody;
    timestamp: number;
    retryCount: number;
    priority?: Priority;
}
