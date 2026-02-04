import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            reportsDirectory: './coverage',
            include: [
                'src/**/*.ts',
                'src/**/*.tsx',
                'lib/**/*.ts',
            ],
            exclude: [
                'src/devlink/**',
                '**/node_modules/**',
                '**/*.test.ts',
                '**/*.spec.ts',
                '**/types/**',
            ],
        },
    },
    resolve: {
        alias: {
            '@/lib': path.resolve(__dirname, './lib'),
            '@': path.resolve(__dirname, './src'),
        },
    },
});
