export interface RequestItem {
    id: string;
    url: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers: Record<string, string>;
    body: any;
    timestamp: number;
    retryCount: number;
}
