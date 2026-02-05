import { describe, it, expect, vi } from 'vitest';
import { generateUUID } from '../src/utils/uuid';
import { EventEmitter } from '../src/utils/events';
import { calculateBackoff } from '../src/utils/backoff';

describe('Core Utilities', () => {
    describe('UUID', () => {
        it('should generate a valid UUID v4', () => {
            const uuid = generateUUID();
            expect(uuid).toMatch(
                /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            );
        });

        it('should generate unique UUIDs', () => {
            const u1 = generateUUID();
            const u2 = generateUUID();
            expect(u1).not.toBe(u2);
        })
    });

    describe('EventEmitter', () => {
        type TestEvents = {
            data: string;
            error: Error;
        };

        it('should emit and receive events', () => {
            const emitter = new EventEmitter<TestEvents>();
            const spy = vi.fn();

            emitter.on('data', spy);
            emitter.emit('data', 'hello');

            expect(spy).toHaveBeenCalledWith('hello');
        });

        it('should unsubscribe correctly', () => {
            const emitter = new EventEmitter<TestEvents>();
            const spy = vi.fn();

            emitter.on('data', spy);
            emitter.off('data', spy);
            emitter.emit('data', 'hello');

            expect(spy).not.toHaveBeenCalled();
        });

        it('should handle multiple listeners', () => {
            const emitter = new EventEmitter<TestEvents>();
            const spy1 = vi.fn();
            const spy2 = vi.fn();

            emitter.on('data', spy1);
            emitter.on('data', spy2);
            emitter.emit('data', 'test');

            expect(spy1).toHaveBeenCalledWith('test');
            expect(spy2).toHaveBeenCalledWith('test');
        });
    });

    describe('Backoff', () => {
        it('should increase exponentially', () => {
            const delay1 = calculateBackoff(0, 100, 10000);
            const delay2 = calculateBackoff(1, 100, 10000);
            const delay3 = calculateBackoff(2, 100, 10000);

            expect(delay2).toBeGreaterThan(delay1);
            expect(delay3).toBeGreaterThan(delay2);
        });

        it('should cap at maxDelay', () => {
            const max = 1000;
            // High attempt count to force max
            const delay = calculateBackoff(10, 100, max);
            // The implementation allows max + 100 jitter
            expect(delay).toBeLessThanOrEqual(max + 100);
        });

        it('should include jitter', () => {
            // Run multiple times to check if output varies for same input
            const outputs = new Set();
            for (let i = 0; i < 50; i++) {
                outputs.add(calculateBackoff(1, 100, 1000));
            }
            // If jitter works, we should have more than 1 unique value
            expect(outputs.size).toBeGreaterThan(1);
        });
    });
});
