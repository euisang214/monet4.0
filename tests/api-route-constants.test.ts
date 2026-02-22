import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import path from 'path';

const WORKSPACE_ROOT = process.cwd();
const SEARCH_ROOTS = ['src', 'lib'];
const CODE_EXTENSIONS = new Set(['.ts', '.tsx']);
const DIRECT_API_FETCH_PATTERN = /fetch\(\s*['\"`]\/api\//;

function collectCodeFiles(directory: string, files: string[] = []) {
    const entries = readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'coverage') {
            continue;
        }

        const absolutePath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            collectCodeFiles(absolutePath, files);
            continue;
        }

        if (CODE_EXTENSIONS.has(path.extname(entry.name))) {
            files.push(absolutePath);
        }
    }

    return files;
}

describe('API route constants adoption', () => {
    it('avoids direct fetch("/api/..."), using appRoutes constants instead', () => {
        const allFiles = SEARCH_ROOTS.flatMap((root) => collectCodeFiles(path.join(WORKSPACE_ROOT, root)));

        const offenders = allFiles
            .map((filePath) => {
                const content = readFileSync(filePath, 'utf8');
                return DIRECT_API_FETCH_PATTERN.test(content)
                    ? path.relative(WORKSPACE_ROOT, filePath)
                    : null;
            })
            .filter((filePath): filePath is string => Boolean(filePath));

        expect(offenders).toEqual([]);
    });
});
