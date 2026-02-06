import React, { useState, useEffect, useRef } from 'react';
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
    RefreshCw
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

// --- Components ---

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: any }) => (
    <div className={cn("bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl overflow-hidden flex flex-col", className)}>
        {title && (
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2 bg-slate-50/50 dark:bg-slate-800/50">
                {Icon && <Icon className="w-4 h-4 text-slate-500" />}
                <h3 className="font-semibold text-slate-700 dark:text-slate-200 text-sm uppercase tracking-wide">{title}</h3>
            </div>
        )}
        <div className="p-6 flex-1 flex flex-col relative">
            {children}
        </div>
    </div>
);

const Badge = ({ active, label, icon: Icon, color }: { active: boolean, label: string, icon: any, color: 'green' | 'red' | 'blue' | 'amber' }) => {
    const colors = {
        green: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
        red: "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800",
        blue: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        amber: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
    };

    return (
        <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all duration-300",
            active ? colors[color] : "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:border-slate-700 grayscale"
        )}>
            <Icon className={cn("w-3.5 h-3.5", active && "animate-pulse")} />
            <span>{label}</span>
        </div>
    );
};

// --- Main App ---

export default function App() {
    const { isOnline, isSyncing, queueSize } = useRestSync(apiSync);
    const [simulatedOffline, setSimulatedOffline] = useState(false);
    const [priority, setPriority] = useState<Priority>('normal');
    const [logs, setLogs] = useState<{ id: string, msg: string, type: 'info' | 'success' | 'error' | 'warn' }[]>([]);
    const logScrollRef = useRef<HTMLDivElement>(null);

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
    }, []);

    // Auto-scroll logs
    useEffect(() => {
        if (logScrollRef.current) {
            logScrollRef.current.scrollTop = logScrollRef.current.scrollHeight;
        }
    }, [logs]);

    // Listeners
    useEffect(() => {
        const hSuccess = ({ id }: any) => {
            toast.success(`Request synced!`, { id: `s-${id}` });
            addLog(`Request ${id} synced successfully`, 'success');
        };
        const hError = ({ id, permanent }: any) => {
            if (!permanent) return; // Ignore transient
            toast.error(`Request failed`, { id: `e-${id}` });
            addLog(`Request ${id} failed permanently`, 'error');
        };
        const hSyncStart = () => addLog('Synchronization started...', 'info');
        const hSyncEnd = () => addLog('Synchronization completed.', 'success');

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

    const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
        setLogs(p => [...p, { id: Math.random().toString(36), msg, type }].slice(-100));
    };

    const toggleOffline = () => {
        const newState = !simulatedOffline;
        setSimulatedOffline(newState);
        (window as any)._forceOffline = newState;
        window.dispatchEvent(new Event(newState ? 'offline' : 'online'));
        toast(newState ? 'Simulated Offline Mode' : 'Back Online', {
            icon: newState ? '🔌' : '🌍',
            style: { background: newState ? '#333' : '#fff', color: newState ? '#fff' : '#000' }
        });
        addLog(newState ? 'Offline mode enabled' : 'Online mode restored', 'warn');
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
                    addLog(`Request ${id} queued (${priority})`, 'info');
                    return `Request Queued (Offline/Background)`;
                }
                addLog(`Request ${id} sent directly`, 'success');
                return `Sent Directly!`;
            },
            error: 'Fatal Error'
        });
    };

    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const id = `file-${Date.now().toString().slice(-4)}`;

        await apiSync.fetch('https://httpbin.org/post', {
            method: 'POST',
            body: (() => { const fd = new FormData(); fd.append('f', file); return fd; })(),
            priority: 'high',
            id
        });

        // Reset input
        e.target.value = '';
        const msg = isOnline && !simulatedOffline ? 'File uploading...' : 'File upload queued';
        toast(msg, { icon: '📁' });
        addLog(msg, 'info');
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8 font-sans transition-colors duration-300">
            <Toaster position="bottom-right" toastOptions={{ className: 'dark:bg-slate-800 dark:text-white', duration: 4000 }} />

            <header className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent flex items-center gap-3">
                        <Cloud className="w-8 h-8 text-blue-600" />
                        Rest-Sync-Lite
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Professional Background Sync Playground &hearts;</p>
                </div>
                <div className="flex items-center gap-3">
                    <a href="https://github.com/mircdj/rest-sync-lite" target="_blank" className="text-sm font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors">Documentation</a>
                    <span className="w-px h-4 bg-slate-300 dark:bg-slate-700"></span>
                    <span className="text-xs px-2 py-1 bg-slate-200 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-400">v1.3.0</span>
                </div>
            </header>

            <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">

                {/* --- LEFT COLUMN: STATUS --- */}
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
                                    icon={RefreshCw}
                                />
                                <Badge
                                    label={`${queueSize} Pending Items`}
                                    active={queueSize > 0}
                                    color={queueSize > 0 ? "amber" : "green"}
                                    icon={Database}
                                />
                            </div>

                            <hr className="border-slate-100 dark:border-slate-700" />

                            <div className="space-y-2">
                                <button
                                    onClick={toggleOffline}
                                    className={cn(
                                        "w-full py-2.5 px-4 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200 shadow-sm",
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
                                    className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Force Sync Now
                                </button>
                            </div>
                        </div>
                    </Card>

                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800/50">
                        <h4 className="text-blue-800 dark:text-blue-300 font-semibold mb-1 flex items-center gap-2 text-sm">
                            <Zap className="w-4 h-4" />
                            Did you know?
                        </h4>
                        <p className="text-xs text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
                            If you close this tab while requests are queued, the <strong>Service Worker</strong> will wake up to sync them in the background!
                        </p>
                    </div>
                </div>

                {/* --- MIDDLE COLUMN: ACTION --- */}
                <div className="lg:col-span-6 space-y-6">
                    <Card title="New Request" className="h-full" icon={Send}>
                        <form onSubmit={sendRequest} className="flex flex-col h-full gap-6">

                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex flex-col gap-2 cursor-pointer group">
                                    <span className="text-xs font-semibold text-slate-500 uppercase">Priority</span>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value as Priority)}
                                        className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        <option value="high">⚡️ High Priority</option>
                                        <option value="normal">🔵 Normal</option>
                                        <option value="low">🐢 Low Background</option>
                                    </select>
                                </label>

                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-semibold text-slate-500 uppercase">Type</span>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-500 cursor-not-allowed">
                                        POST JSON
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-gradient-to-br from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-4 rounded-xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
                            >
                                <Send className="w-5 h-5" />
                                Send Data
                            </button>

                            <div className="relative my-2">
                                <div className="absolute inset-0 flex items-center">
                                    <span className="w-full border-t border-slate-200 dark:border-slate-700" />
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-white dark:bg-slate-800 px-2 text-slate-400">Or Upload Binary</span>
                                </div>
                            </div>

                            <label className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all group">
                                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                                    <FileUp className="w-6 h-6 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                                </div>
                                <div className="text-center">
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Click to upload file</span>
                                    <p className="text-xs text-slate-400 mt-1">Supports Blob/FormData automatically</p>
                                </div>
                                <input type="file" onChange={uploadFile} className="hidden" />
                            </label>

                        </form>
                    </Card>
                </div>

                {/* --- RIGHT COLUMN: LOGS --- */}
                <div className="lg:col-span-3">
                    <Card title="Live Activity" className="h-[600px] lg:h-full" icon={Clock}>
                        <div ref={logScrollRef} className="flex-1 overflow-y-auto pr-2 space-y-3">
                            {logs.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm">
                                    <Activity className="w-8 h-8 mb-2 opacity-20" />
                                    No activity yet
                                </div>
                            )}
                            {logs.map((log, i) => (
                                <div key={i} className="flex items-start gap-3 text-xs p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0",
                                        log.type === 'info' && "bg-slate-400",
                                        log.type === 'success' && "bg-emerald-500",
                                        log.type === 'error' && "bg-rose-500",
                                        log.type === 'warn' && "bg-amber-500",
                                    )} />
                                    <div className="flex-1">
                                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                            {log.msg}
                                        </p>
                                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 block opacity-60">ID: {log.id.slice(0, 6)}</span>
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
