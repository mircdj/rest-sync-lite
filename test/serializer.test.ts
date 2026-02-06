import { describe, it, expect } from 'vitest';
import { serializeBody } from '../src/utils/serializer';

describe('Serializer', () => {
    it('should pass through string bodies', () => {
        const body = 'test string';
        expect(serializeBody(body)).toBe(body);
    });

    it('should stringify objects', () => {
        const body = { foo: 'bar' };
        expect(serializeBody(body)).toBe(JSON.stringify(body));
    });

    it('should pass through Blob', () => {
        const blob = new Blob(['test'], { type: 'text/plain' });
        expect(serializeBody(blob)).toBe(blob);
    });

    it('should pass through FormData', () => {
        const formData = new FormData();
        formData.append('key', 'value');
        expect(serializeBody(formData)).toBe(formData);
    });

    it('should pass through URLSearchParams', () => {
        const params = new URLSearchParams('foo=bar');
        expect(serializeBody(params)).toBe(params);
    });

    it('should return null for null/undefined', () => {
        expect(serializeBody(null)).toBeNull();
        expect(serializeBody(undefined)).toBeNull();
    });
});
