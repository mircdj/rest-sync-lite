import React, { useState, useEffect } from 'react';
import { RestSyncLite, type Priority } from 'rest-sync-lite';
import { useRestSync } from 'rest-sync-lite/react';
import toast, { Toaster } from 'react-hot-toast';

// Initialize singleton
const apiSync = new RestSyncLite({
    dbName: 'PlaygroundDB',
    maxRetries: 3
});

// Force offline hack for demo
(window as any)._forceOffline = false;

function App() {
    const { isOnline, isSyncing, queueSize } = useRestSync(apiSync);
    const [simulatedOffline, setSimulatedOffline] = useState(false);
    const [priority, setPriority] = useState<Priority>('normal');
    const [logs, setLogs] = useState<string[]>([]);

    const appendLog = (msg: string) => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
    };

    useEffect(() => {
        // Register SW
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register(new URL('./sw.ts', import.meta.url), { type: 'module' })
                .then(reg => console.log('SW Registered', reg))
                .catch(err => console.error('SW Error', err));
        }

        // Internal Event Listeners for Toasts
        const onSuccess = ({ id }: any) => {
            toast.success(`Request ${id} synced!`);
            appendLog(`✅ Request ${id} synced`);
        };
        const onError = ({ id, permanent }: any) => {
            toast.error(`Request ${id} failed (${permanent ? 'Permanent' : 'Transient'})`);
            appendLog(`❌ Request ${id} error`);
        };
        const onQueueEmpty = () => {
            // success toast already shown per item, maybe just log
            appendLog('Queue empty - All caught up.');
        };

        apiSync.syncEngine.events.on('request-success', onSuccess);
        apiSync.syncEngine.events.on('request-error', onError);
        apiSync.syncEngine.events.on('queue-empty', onQueueEmpty);

        return () => {
            apiSync.syncEngine.events.off('request-success', onSuccess);
            apiSync.syncEngine.events.off('request-error', onError);
            apiSync.syncEngine.events.off('queue-empty', onQueueEmpty);
        };
    }, []);

    const toggleOffline = () => {
        const newState = !simulatedOffline;
        setSimulatedOffline(newState);
        (window as any)._forceOffline = newState;
        window.dispatchEvent(new Event(newState ? 'offline' : 'online'));
        toast(newState ? 'Offline Mode Activated' : 'Back Online!', { icon: newState ? '🔌' : '🌍' });
    };

    const sendRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const url = 'https://jsonplaceholder.typicode.com/posts';

        appendLog(`Sending ${priority} priority request...`);

        try {
            const res = await apiSync.fetch(url, {
                method: 'POST',
                body: JSON.stringify({ title: 'Demo', date: Date.now() }),
                headers: { 'Content-Type': 'application/json' },
                priority: priority,
                id: `req-${Date.now()}`
            });

            if (res.status === 202) {
                toast('Request Queued (Offline)', { icon: '📥' });
                appendLog('⚡️ Queued for Background Sync!');
            } else if (res.ok) {
                toast.success('Sent directly!');
                appendLog('✅ Sent successfully!');
            }
        } catch (err) {
            toast.error('Fetch Error');
            console.error(err);
        }
    };

    const uploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('file', file);

        toast.loading('Uploading file...');
        await apiSync.fetch('https://httpbin.org/post', {
            method: 'POST',
            body: formData,
            priority: 'high'
        });
        toast.dismiss();
        toast('File upload queued/sent', { icon: '📁' });
    };

    return (
        <div style={{ padding: 20, maxWidth: 800, margin: '0 auto', fontFamily: 'system-ui' }}>
            <Toaster position="top-right" />
            <h1>📡 Rest-Sync-Lite v1.3.0</h1>

            {/* Status Panel */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20,
                padding: 15, background: '#f5f5f5', borderRadius: 8
            }}>
                <div style={{ textAlign: 'center' }}>
                    <strong>Network</strong><br />
                    <span style={{
                        color: isOnline ? 'green' : 'red',
                        fontWeight: 'bold', fontSize: '1.2em'
                    }}>
                        {isOnline ? 'ONLINE' : 'OFFLINE'}
                    </span>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <strong>Status</strong><br />
                    <span>{isSyncing ? '🔄 Syncing...' : 'Idle'}</span>
                </div>
                <div style={{ textAlign: 'center' }}>
                    <strong>Queue</strong><br />
                    <span style={{ fontSize: '1.2em' }}>{queueSize}</span> items
                </div>
            </div>

            {/* Controls */}
            <div style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                    onClick={toggleOffline}
                    style={{
                        padding: '10px 20px', cursor: 'pointer',
                        background: simulatedOffline ? '#ff4444' : '#44cc44', color: 'white', border: 'none', borderRadius: 4
                    }}
                >
                    {simulatedOffline ? '🔌 Go Online' : '✂️ Simulate Offline'}
                </button>

                <button onClick={() => apiSync.syncNow()} disabled={!isOnline} style={{ padding: '10px 20px', cursor: 'pointer' }}>
                    🔄 Force Sync
                </button>
            </div>

            {/* Request Form */}
            <div style={{ border: '1px solid #ddd', padding: 20, borderRadius: 8, marginBottom: 20 }}>
                <h3>📝 New Request</h3>
                <form onSubmit={sendRequest} style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <select
                        value={priority}
                        onChange={e => setPriority(e.target.value as Priority)}
                        style={{ padding: 8 }}
                    >
                        <option value="high">High Priority ⚡️</option>
                        <option value="normal">Normal</option>
                        <option value="low">Low</option>
                    </select>
                    <button type="submit" style={{ padding: '8px 16px', background: '#007bff', color: 'white', border: 'none', borderRadius: 4 }}>
                        Send Request
                    </button>
                </form>

                <div style={{ marginTop: 10 }}>
                    <label>Upload File (Auto-queues): </label>
                    <input type="file" onChange={uploadFile} />
                </div>
            </div>

            {/* Logs */}
            <div style={{ background: '#222', color: '#0f0', padding: 15, borderRadius: 8, height: 300, overflowY: 'auto', fontSize: '0.9em' }}>
                {logs.map((log, i) => (
                    <div key={i} style={{ borderBottom: '1px solid #333', padding: '2px 0' }}>{log}</div>
                ))}
            </div>
        </div>
    );
}

export default App;
