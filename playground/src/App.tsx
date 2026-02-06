import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RestSyncLite, type Priority } from 'rest-sync-lite';
import { useRestSync } from 'rest-sync-lite/react';
import toast, { Toaster } from 'react-hot-toast';
import {
    Cloud,
    Wifi,
    WifiOff,
    Database,
    Send,
    FileUp,
    Activity,
    Zap,
    Clock,
    RefreshCw,
    Loader2,
    CheckCircle,
    XCircle,
    Image as ImageIcon,
    FileText,
    Trash2
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Init & Config ---
const apiSync = new RestSyncLite({
    dbName: 'PlaygroundSyncDB',
    maxRetries: 3
});
(window as any)._forceOffline = false;

// --- Types ---
interface QueueItem {
    id: string;
    url: string;
    method: string;
    priority: Priority;
    createdAt: number;
    retryCount?: number;
}

interface LogEntry {
    id: string;
    msg: string;
    type: 'info' | 'success' | 'error' | 'warn';
    timestamp: Date;
}

interface FilePreview {
    name: string;
    size: number;
    type: string;
    preview?: string;
}

// --- Components ---

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: any }) => (
    <div className={cn("bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl overflow-hidden flex flex-col", className)}>
        {title && (
            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/50">
                {Icon && <Icon className="w-5 h-5 text-slate-500" />}
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-base uppercase tracking-wide">{title}</h3>
            </div>
        )}
        <div className="p-6 md:p-8 flex-1 flex flex-col relative">
            {children}
        </div>
    </div>
);

const Badge = ({ active, label, icon: Icon, color, spinning }: { active: boolean, label: string, icon: any, color: 'green' | 'red' | 'blue' | 'amber', spinning?: boolean }) => {
    const colors = {
        green: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
        red: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800",
        blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        amber: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    };

    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-semibold transition-all duration-300",
            active ? colors[color] : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 grayscale"
        )}>
            <Icon className={cn("w-4 h-4", spinning && "animate-spin", active && !spinning && "animate-pulse")} />
            <span>{label}</span>
        </div>
    );
};

// Queue Item Display
const QueueItemCard = ({ item, onCancel }: { item: QueueItem, onCancel: (id: string) => void }) => (
    <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
        <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
                <span className={cn(
                    "px-1.5 py-0.5 rounded text-xs font-bold",
                    item.priority === 'high' && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                    item.priority === 'normal' && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
                    item.priority === 'low' && "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                )}>
                    {item.method}
                </span>
                <span className="text-slate-600 dark:text-slate-400 truncate">{item.url.slice(0, 30)}...</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
                ID: {item.id.slice(0, 8)} • Retries: {item.retryCount || 0}
            </div>
        </div>
        <button
            onClick={() => onCancel(item.id)}
            className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
        >
            <Trash2 className="w-4 h-4" />
        </button>
    </div>
);

// --- Main App ---

export default function App() {
    const { isOnline, isSyncing, queueSize } = useRestSync(apiSync);
    const [simulatedOffline, setSimulatedOffline] = useState(false);
    const [priority, setPriority] = useState<Priority>('normal');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
    const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const logScrollRef = useRef<HTMLDivElement>(null);

    // Fetch queue items from IndexedDB using PUBLIC API
    const refreshQueue = useCallback(async () => {
        try {
            const items = await apiSync.getQueueItems();
            setQueueItems(items.map((item: any) => ({
                id: item.id,
                url: item.url,
                method: item.method,
                priority: item.priority || 'normal',
                createdAt: item.timestamp,
                retryCount: item.retryCount || 0
            })));
        } catch (err) {
            console.warn('Could not fetch queue items', err);
        }
    }, []);

    // --- Effects & Logic ---

    // Initial SW Register
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                const swUrl = import.meta.env.BASE_URL + 'sw.js';
                navigator.serviceWorker.register(swUrl, { type: 'module' })
                    .then(() => addLog('Service Worker Registered (PWA Ready)', 'info'))
                    .catch(e => addLog(`SW Error: ${e.message}`, 'error'));
            });
        }
        addLog('Playground Initialized', 'info');
        refreshQueue();
    }, [refreshQueue]);

    // Refresh queue on events + auto-poll every 2s during sync
    useEffect(() => {
        const refresh = () => {
            setTimeout(refreshQueue, 100); // Small delay to let DB update
        };
        apiSync.events.on('queue:update', refresh);
        apiSync.events.on('sync:start', refresh);
        apiSync.events.on('sync:end', refresh);
        apiSync.events.on('request-success', refresh);
        apiSync.events.on('request-error', refresh);

        // Auto-poll every 2 seconds for live updates
        const interval = setInterval(refreshQueue, 2000);

        return () => {
            apiSync.events.off('queue:update', refresh);
            apiSync.events.off('sync:start', refresh);
            apiSync.events.off('sync:end', refresh);
            apiSync.events.off('request-success', refresh);
            apiSync.events.off('request-error', refresh);
            clearInterval(interval);
        };
    }, [refreshQueue]);

    // Listeners
    useEffect(() => {
        const hSuccess = ({ id, item }: any) => {
            const priorityLabel = item?.priority ? `[${item.priority.toUpperCase()}] ` : '';
            toast.success(`${priorityLabel}Request synced!`, { id: `s-${id}` });
            addLog(`✓ Request ${id} synced successfully`, 'success');
        };
        const hError = ({ id, permanent }: any) => {
            if (!permanent) return;
            toast.error(`Request failed`, { id: `e-${id}` });
            addLog(`✗ Request ${id} failed permanently`, 'error');
        };
        const hSyncStart = () => {
            addLog('🔄 Synchronization started...', 'info');
            toast.loading('Syncing queued requests...', { id: 'sync-status' });
        };
        const hSyncEnd = () => {
            // The queueSize update will happen automatically via useRestSync hook
            // which listens to 'queue:update', triggered by SyncEngine -> QueueManager -> syncSize()
            addLog('✓ Synchronization completed', 'success');
            toast.success('Sync complete!', { id: 'sync-status' });

            // Force refresh queue list one last time
            refreshQueue();
        };

        apiSync.events.on('request-success', hSuccess);
        apiSync.events.on('request-error', hError);
        apiSync.events.on('sync:start', hSyncStart);
        apiSync.events.on('sync:end', hSyncEnd);

        return () => {
            apiSync.events.off('request-success', hSuccess);
            apiSync.events.off('request-error', hError);
            apiSync.events.off('sync:start', hSyncStart);
            apiSync.events.off('sync:end', hSyncEnd);
        }
    }, []);

    // Add log entry (newest first)
    const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
        setLogs(p => [{ id: Math.random().toString(36), msg, type, timestamp: new Date() }, ...p].slice(0, 100));
    };

    const toggleOffline = () => {
        const newState = !simulatedOffline;
        setSimulatedOffline(newState);

        // Use the new public API
        apiSync.setOfflineMode(newState);

        addLog(newState ? '🔌 Simulation: Forced Offline Mode' : '🔌 Simulation: Reverting to Real Network', 'info');
        toast(newState ? 'Simulated Offline Mode' : 'Back Online', {
            icon: newState ? '🔌' : '🌍',
            style: { background: newState ? '#333' : '#fff', color: newState ? '#fff' : '#000' }
        });
    };

    const sendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const id = `req-${Date.now().toString().slice(-4)}`;
        const promise = apiSync.fetch('https://jsonplaceholder.typicode.com/posts', {
            method: 'POST',
            body: JSON.stringify({ title: 'Demo', ts: Date.now() }),
            headers: { 'Content-Type': 'application/json' },
            priority,
            id
        });

        toast.promise(promise, {
            loading: 'Processing...',
            success: (res) => {
                if (res.status === 202) {
                    addLog(`📥 Request ${id} queued (${priority} priority)`, 'info');
                    return `Request Queued`;
                }
                addLog(`📤 Request ${id} sent directly`, 'success');
                return `Sent Directly!`;
            },
            error: 'Fatal Error'
        });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];

        // Create preview
        const preview: FilePreview = {
            name: file.name,
            size: file.size,
            type: file.type,
        };

        // Generate image preview if applicable
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setFilePreview({ ...preview, preview: ev.target?.result as string });
            };
            reader.readAsDataURL(file);
        } else {
            setFilePreview(preview);
        }
    };

    const uploadFile = async () => {
        if (!filePreview) return;

        setIsUploading(true);
        const id = `file-${Date.now().toString().slice(-4)}`;

        // Get the actual file from input
        const input = document.querySelector('input[type="file"]') as HTMLInputElement;
        const file = input?.files?.[0];

        if (!file) {
            setIsUploading(false);
            return;
        }

        try {
            await apiSync.fetch('https://httpbin.org/post', {
                method: 'POST',
                body: (() => { const fd = new FormData(); fd.append('f', file); return fd; })(),
                priority: 'high',
                id
            });

            const msg = isOnline && !simulatedOffline ? `📤 File "${file.name}" uploading...` : `📥 File "${file.name}" queued`;
            toast.success(msg);
            addLog(msg, isOnline && !simulatedOffline ? 'success' : 'info');

            // Clear preview
            setFilePreview(null);
            if (input) input.value = '';
        } finally {
            setIsUploading(false);
        }
    };

    const cancelRequest = async (id: string) => {
        const success = await apiSync.cancelRequest(id);
        if (success) {
            toast.success(`Cancelled request ${id.slice(0, 8)}`);
            addLog(`🗑 Cancelled request ${id}`, 'warn');
            refreshQueue();
        }
    };

    const formatBytes = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    const formatTime = (date: Date) => {
        return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8 font-sans transition-colors duration-300">
            <Toaster position="bottom-right" toastOptions={{ className: 'dark:bg-slate-800 dark:text-white', duration: 4000 }} />

            <header className="w-full px-4 lg:px-12 xl:px-20 mx-auto mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                        <Cloud className="w-10 h-10 text-blue-600" />
                        Rest-Sync-Lite
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Professional Background Sync Playground &hearts;</p>
                </div>
                <div className="flex items-center gap-3">
                    <a href="https://github.com/mircdj/rest-sync-lite" target="_blank" className="text-base font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">Documentation</a>
                    <span className="w-px h-4 bg-slate-300 dark:bg-slate-700"></span>
                    <span className="text-sm px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-400">v1.3.0</span>
                </div>
            </header>

            <main className="w-full px-4 lg:px-12 xl:px-20 mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                {/* --- LEFT COLUMN: STATUS + QUEUE --- */}
                <div className="lg:col-span-3 space-y-6">
                    <Card title="System Status" icon={Activity}>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3">
                                <Badge
                                    label={isOnline && !simulatedOffline ? "Network Online" : "Network Offline"}
                                    active={isOnline && !simulatedOffline}
                                    color={isOnline && !simulatedOffline ? "green" : "red"}
                                    icon={isOnline && !simulatedOffline ? Wifi : WifiOff}
                                />
                                <Badge
                                    label={isSyncing ? "Syncing..." : "Sync Idle"}
                                    active={isSyncing}
                                    color={isSyncing ? "blue" : "blue"}
                                    icon={isSyncing ? Loader2 : RefreshCw}
                                    spinning={isSyncing}
                                />
                                <Badge
                                    label={`${queueSize} Pending Items`}
                                    active={queueSize > 0}
                                    color={queueSize > 0 ? "amber" : "green"}
                                    icon={Database}
                                />
                            </div>

                            <hr className="border-slate-100 dark:border-slate-700" />

                            <div className="space-y-3">
                                <button
                                    onClick={toggleOffline}
                                    className={cn(
                                        "w-full py-3 px-4 rounded-lg flex items-center justify-center gap-2 text-base font-medium transition-all duration-200 shadow-sm",
                                        simulatedOffline
                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700"
                                            : "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 hover:border-rose-200 dark:bg-rose-900/20 dark:border-rose-800"
                                    )}
                                >
                                    {simulatedOffline ? 'Restore Connection' : 'Simulate Offline'}
                                </button>

                                <button
                                    onClick={() => apiSync.syncNow()}
                                    disabled={!isOnline || simulatedOffline || isSyncing}
                                    className="w-full py-3 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-base font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSyncing && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {isSyncing ? 'Syncing...' : 'Force Sync Now'}
                                </button>
                            </div>
                        </div>
                    </Card>

                    {/* IndexedDB Queue Viewer */}
                    <Card title="IndexedDB Queue" icon={Database}>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto">
                            {queueItems.length === 0 ? (
                                <div className="text-center text-slate-400 py-6">
                                    <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-sm">Queue is empty</p>
                                </div>
                            ) : (
                                queueItems.map(item => (
                                    <QueueItemCard key={item.id} item={item} onCancel={cancelRequest} />
                                ))
                            )}
                        </div>
                        <button
                            onClick={refreshQueue}
                            className="mt-4 w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-3 h-3" /> Refresh Queue
                        </button>
                    </Card>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5 border border-blue-100 dark:border-blue-800/50">
                        <h4 className="text-blue-800 dark:text-blue-300 font-semibold mb-2 flex items-center gap-2 text-base">
                            <Zap className="w-5 h-5" />
                            Did you know?
                        </h4>
                        <p className="text-sm text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                            If you close this tab while requests are queued, the <strong>Service Worker</strong> will wake up to sync them in the background!
                        </p>
                    </div>
                </div>

                {/* --- MIDDLE COLUMN: ACTION --- */}
                <div className="lg:col-span-5 space-y-6">
                    <Card title="New Request" className="h-full" icon={Send}>
                        <form onSubmit={sendRequest} className="flex flex-col h-full gap-6">

                            <div className="grid grid-cols-2 gap-6">
                                <label className="flex flex-col gap-3 cursor-pointer group">
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Priority</span>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value as Priority)}
                                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <option value="high">⚡️ High Priority</option>
                                        <option value="normal">🔵 Normal</option>
                                        <option value="low">🐢 Low Background</option>
                                    </select>
                                </label>

                                <div className="flex flex-col gap-3">
                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Type</span>
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-base text-slate-500 cursor-not-allowed">
                                        POST JSON
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-5 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-3 text-lg"
                            >
                                <Send className="w-6 h-6" />
                                Send Data
                            </button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest">
                                    <span className="bg-white dark:bg-slate-800 px-4 text-slate-400">Or Upload Binary</span>
                                </div>
                            </div>

                            {/* File Upload with Preview */}
                            {!filePreview ? (
                                <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group border-opacity-70">
                                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                                        <FileUp className="w-8 h-8 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                                    </div>
                                    <div className="text-center">
                                        <span className="text-base font-medium text-slate-700 dark:text-slate-300">Click to upload file</span>
                                        <p className="text-sm text-slate-400 mt-1">Supports Blob/FormData automatically</p>
                                    </div>
                                    <input type="file" onChange={handleFileSelect} className="hidden" />
                                </label>
                            ) : (
                                <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-6 space-y-4">
                                    <div className="flex items-start gap-4">
                                        {filePreview.preview ? (
                                            <img src={filePreview.preview} alt="Preview" className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                        ) : (
                                            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                                                {filePreview.type.startsWith('image/') ? (
                                                    <ImageIcon className="w-8 h-8 text-slate-400" />
                                                ) : (
                                                    <FileText className="w-8 h-8 text-slate-400" />
                                                )}
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium text-slate-700 dark:text-slate-300 truncate">{filePreview.name}</p>
                                            <p className="text-sm text-slate-400">{formatBytes(filePreview.size)}</p>
                                            <p className="text-xs text-slate-400 mt-1">{filePreview.type || 'Unknown type'}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={uploadFile}
                                            disabled={isUploading}
                                            className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                                            {isUploading ? 'Uploading...' : 'Upload'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFilePreview(null)}
                                            className="px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium rounded-lg flex items-center justify-center gap-2"
                                        >
                                            <XCircle className="w-4 h-4" />
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}

                        </form>
                    </Card>
                </div>

                {/* --- RIGHT COLUMN: LOGS --- */}
                <div className="lg:col-span-4">
                    <Card title="Live Activity" className="h-[700px]" icon={Clock}>
                        <div className="flex justify-between items-center mb-4 -mt-2">
                            <span className="text-xs text-slate-400">{logs.length} entries</span>
                            <button
                                onClick={() => setLogs([])}
                                className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                            >
                                <Trash2 className="w-3 h-3" /> Clear
                            </button>
                        </div>
                        <div ref={logScrollRef} className="flex-1 overflow-y-auto pr-2 space-y-2">
                            {logs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                                    <Activity className="w-10 h-10 mb-3 opacity-20" />
                                    No activity yet
                                </div>
                            )}
                            {logs.map((log) => (
                                <div key={log.id} className="flex items-start gap-3 text-sm p-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
                                        log.type === 'info' && "bg-slate-400",
                                        log.type === 'success' && "bg-emerald-500",
                                        log.type === 'error' && "bg-rose-500",
                                        log.type === 'warn' && "bg-amber-500",
                                    )} />
                                    <div className="flex-1">
                                        <p className="text-slate-700 dark:text-slate-300 leading-snug font-medium">
                                            {log.msg}
                                        </p>
                                        <span className="text-xs text-slate-400 font-mono mt-1 block opacity-60">{formatTime(log.timestamp)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>

            </main>
        </div>
    );
}
