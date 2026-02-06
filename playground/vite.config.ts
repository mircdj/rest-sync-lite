import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react'; // Added import for react plugin

export default defineConfig({
    base: '/rest-sync-lite/', // GitHub Pages base URL
    plugins: [react()], // Moved plugins to the top level of defineConfig
    resolve: {
        alias: {
            'rest-sync-lite/react': path.resolve(__dirname, '../src/react/index.ts'),
            'rest-sync-lite/sw': path.resolve(__dirname, '../src/sw/index.ts'),
            'rest-sync-lite': path.resolve(__dirname, '../src/index.ts'),
        }
    },
    // Optimize deps to avoid issues with linked local packages
    optimizeDeps: {
        exclude: ['rest-sync-lite'],
    },
    server: {
        fs: {
            // Allow serving files from one level up to the project root
            allow: ['..']
        }
    }
});
