import { useState, useEffect } from 'react';
import type { RestSyncLite } from '../index';

export interface RestSyncState {
    isOnline: boolean;
    isSyncing: boolean;
    queueSize: number;
}

export function useRestSync(instance: RestSyncLite): RestSyncState {
    // Initialize state synchronously from instance getters to avoid flickering
    const [state, setState] = useState<RestSyncState>(() => ({
        isOnline: instance.isOnline,
        isSyncing: instance.isSyncing,
        queueSize: instance.queueSize
    }));

    useEffect(() => {
        // Handle updates
        const updateState = () => {
            setState({
                isOnline: instance.isOnline,
                isSyncing: instance.isSyncing,
                queueSize: instance.queueSize
            });
        };

        // Subscribe to relevant events
        instance.events.on('network:change', updateState);
        instance.events.on('queue:update', updateState);
        instance.events.on('sync:start', updateState);
        instance.events.on('sync:end', updateState);

        // Initial check in case something changed before effect
        updateState();

        return () => {
            instance.events.off('network:change', updateState);
            instance.events.off('queue:update', updateState);
            instance.events.off('sync:start', updateState);
            instance.events.off('sync:end', updateState);
        };
    }, [instance]);

    return state;
}
