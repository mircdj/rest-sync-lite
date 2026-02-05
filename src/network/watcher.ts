import { EventEmitter } from '../utils/events';

type NetworkEvents = {
    'network-change': boolean; // true = online, false = offline
};

export class NetworkWatcher {
    private events = new EventEmitter<NetworkEvents>();
    private _isOnline: boolean = true;

    constructor() {
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            this._isOnline = navigator.onLine;

            window.addEventListener('online', () => this.updateState(true));
            window.addEventListener('offline', () => this.updateState(false));
        }
    }

    isOnline(): boolean {
        // Allow mocking via a static or global if needed, or just trust navigator
        if ((window as any)._forceOffline) return false;
        if ((window as any)._forceOnline) return true;

        if (typeof navigator !== 'undefined') {
            return navigator.onLine;
        }
        return true;
    }

    onNetworkChange(listener: (isOnline: boolean) => void) {
        this.events.on('network-change', listener);
    }

    private updateState(isOnline: boolean) {
        if (this._isOnline !== isOnline) {
            this._isOnline = isOnline;
            this.events.emit('network-change', isOnline);
        }
    }
}
