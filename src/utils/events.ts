export type EventMap = Record<string, any>;
export type EventKey<T extends EventMap> = string & keyof T;
export type EventReceiver<T> = (params: T) => void;

interface Emitter<T extends EventMap> {
    on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
    off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void;
    emit<K extends EventKey<T>>(eventName: K, params: T[K]): void;
}

/**
 * A type-safe Event Emitter implementation.
 */
export class EventEmitter<T extends EventMap> implements Emitter<T> {
    private listeners: { [K in keyof T]?: Array<EventReceiver<T[K]>> } = {};

    on<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName]!.push(fn);
    }

    off<K extends EventKey<T>>(eventName: K, fn: EventReceiver<T[K]>): void {
        const listeners = this.listeners[eventName];
        if (!listeners) return;
        this.listeners[eventName] = listeners.filter((l) => l !== fn);
    }

    emit<K extends EventKey<T>>(eventName: K, params: T[K]): void {
        const listeners = this.listeners[eventName];
        if (!listeners) return;
        listeners.forEach((fn) => {
            try {
                fn(params);
            } catch (err) {
                console.error(`Error in event listener for ${String(eventName)}:`, err);
            }
        });
    }
}
