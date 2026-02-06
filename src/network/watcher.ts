import { EventEmitter } from '../utils/events';

type NetworkEvents = {
    'network-change': boolean; // true = online, false = offline
};

export class NetworkWatcher {
    private events = new EventEmitter<NetworkEvents>();
    private _isOnline: boolean = true;
    private _forcedOffline: boolean = false;

    constructor() {
        if (typeof window !== 'undefined') {
            this._isOnline = navigator.onLine;
            window.addEventListener('online', () => this.updateState(true));
            window.addEventListener('offline', () => this.updateState(false));
        } else if (typeof self !== 'undefined' && typeof navigator !== 'undefined') {
            // Service Worker context
            this._isOnline = navigator.onLine;
            // SW doesn't always have 'online' events same as window, but safe to check
        }
    }

    isOnline(): boolean {
        if (this._forcedOffline) return false;

        // Trust navigator
        if (typeof navigator !== 'undefined') {
            return navigator.onLine;
        }
        return true;
    }

    /**
     * Manually overrides network state.
     * @param enabled If true, forces offline mode. If false, restores real network state.
     */
    setOfflineMode(enabled: boolean) {
        if (this._forcedOffline === enabled) return;
        this._forcedOffline = enabled;

        // Force state update based on new forced mode + real network state
        const realState = typeof navigator !== 'undefined' ? navigator.onLine : true;

        // If enabling offline mode -> we become offline (false)
        // If disabling custom offline mode -> we revert to real state
        const targetState = enabled ? false : realState;

        this.updateState(targetState);
    }

    onNetworkChange(listener: (isOnline: boolean) => void) {
        this.events.on('network-change', listener);
    }

    private updateState(isOnline: boolean) {
        // If forced offline, and the incoming event says we are online, ignore it.
        // UNLESS this updateState call comes from setOfflineMode itself?
        // Actually, if _forcedOffline is true, we should NEVER emit online.

        // If we are forced offline, the effective state is FALSE.
        // If an event comes in saying "true" (real network online), but _forcedOffline is true, 
        // effectively we are still offline. So we should NOT update _isOnline to true.

        let effectiveState = isOnline;
        if (this._forcedOffline) {
            effectiveState = false;
        }

        if (this._isOnline !== effectiveState) {
            this._isOnline = effectiveState;
            this.events.emit('network-change', effectiveState);
        }
    }
}
