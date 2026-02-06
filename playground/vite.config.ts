import { defineConfig } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react'; // Added import for react plugin

export default defineConfig({
    base: '/rest-sync-lite/', // GitHub Pages base URL
    plugins: [react()], // Moved plugins to the top level of defineConfig
    resolve: {
        dedupe: ['react', 'react-dom'], // Fix for 'useState of null'
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
    },
    build: {
        assetsInlineLimit: 0,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'index.html'),
                sw: path.resolve(__dirname, 'src/sw.ts'),
            },
            output: {
                entryFileNames: (assetInfo) => {
                    return assetInfo.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js';
                }
            }
        }
    },
    worker: {
        format: 'es',
    }
});
