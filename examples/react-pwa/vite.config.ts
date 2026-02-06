import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            'rest-sync-lite/react': path.resolve(__dirname, '../../src/react/index.ts'),
            'rest-sync-lite/sw': path.resolve(__dirname, '../../src/sw/index.ts'),
            'rest-sync-lite': path.resolve(__dirname, '../../src/index.ts'),
        }
    },
    optimizeDeps: {
        exclude: ['rest-sync-lite'],
    },
    server: {
        fs: {
            allow: ['../..']
        }
    }
});
