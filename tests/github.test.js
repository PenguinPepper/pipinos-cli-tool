import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { GitHubClient } from '../commands/src/lib/github.js';

const originalFetch = globalThis.fetch;

function mockFetch(handler) {
    globalThis.fetch = async (url, opts) => handler(url.toString(), opts);
}

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function makeClient(overrides = {}) {
    return new GitHubClient({
        owner: 'acme',
        repo: 'widget',
        token: 'test-token',
        ...overrides,
    });
}

function jsonResponse(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data,
        text: async () => JSON.stringify(data),
    };
}

function textResponse(text, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => text,
    };
}

describe('GitHubClient constructor', () => {
    it('sets Authorization header when token is provided', () => {
        const client = makeClient({ token: 'abc' });
        expect(client.headers.Authorization).toBe('Bearer abc');
    });

    it('omits Authorization header when no token', () => {
        const client = makeClient({ token: undefined });
        expect(client.headers.Authorization).toBeUndefined();
    });
});

describe('fetchMeta', () => {
    it('returns repo metadata', async () => {
        mockFetch((url) =>
            jsonResponse({
                description: 'A cool widget',
                language: 'JavaScript',
                stargazers_count: 42,
                topics: ['ui'],
                default_branch: 'main',
                license: { name: 'MIT' },
            })
        );

        const client = makeClient();
        const [meta, defaultBranch] = await client.fetchMeta();
        expect(meta.description).toBe('A cool widget');
        expect(meta.language).toBe('JavaScript');
        expect(meta.stars).toBe(42);
        expect(meta.topics).toEqual(['ui']);
        expect(meta.license).toBe('MIT');
        expect(defaultBranch).toBe('main');
    });

    it('handles missing optional fields', async () => {
        mockFetch(() =>
            jsonResponse({
                stargazers_count: 0,
                default_branch: 'main',
            })
        );

        const client = makeClient();
        const [meta] = await client.fetchMeta();
        expect(meta.description).toBe('');
        expect(meta.language).toBeNull();
        expect(meta.topics).toEqual([]);
        expect(meta.license).toBeNull();
    });
});

describe('fetchReadme', () => {
    it('decodes base64 readme content', async () => {
        const content = Buffer.from('# Hello World').toString('base64');
        mockFetch(() => jsonResponse({ content }));

        const client = makeClient();
        const readme = await client.fetchReadme();
        expect(readme).toBe('# Hello World');
    });

    it('returns empty string when readme is missing', async () => {
        mockFetch(() => jsonResponse({}, 404));

        const client = makeClient();
        const readme = await client.fetchReadme();
        expect(readme).toBe('');
    });
});

describe('fetchFileTree', () => {
    it('returns blob paths only', async () => {
        mockFetch(() =>
            jsonResponse({
                tree: [
                    { path: 'src/index.js', type: 'blob' },
                    { path: 'src', type: 'tree' },
                    { path: 'README.md', type: 'blob' },
                ],
            })
        );

        const client = makeClient();
        const tree = await client.fetchFileTree('main');
        expect(tree).toEqual(['src/index.js', 'README.md']);
    });

    it('handles empty tree', async () => {
        mockFetch(() => jsonResponse({ tree: [] }));
        const client = makeClient();
        const tree = await client.fetchFileTree('main');
        expect(tree).toEqual([]);
    });

    it('handles missing tree field', async () => {
        mockFetch(() => jsonResponse({}));
        const client = makeClient();
        const tree = await client.fetchFileTree('main');
        expect(tree).toEqual([]);
    });
});

describe('fetchCodeComments', () => {
    it('extracts single-line comments from code files', async () => {
        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) {
                return textResponse('// This is an important comment about the module\nconst x = 1;');
            }
            return jsonResponse({});
        });

        const client = makeClient();
        const comments = await client.fetchCodeComments(['src/index.js'], 'main');
        expect(comments.length).toBeGreaterThan(0);
        expect(comments[0].file).toBe('src/index.js');
        expect(comments[0].type).toBe('single');
    });

    it('extracts block comments', async () => {
        const code = [
            '/**',
            ' * This function initializes the widget framework properly',
            ' */',
            'function init() {}',
        ].join('\n');

        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) return textResponse(code);
            return jsonResponse({});
        });

        const client = makeClient();
        const comments = await client.fetchCodeComments(['src/init.js'], 'main');
        expect(comments.length).toBeGreaterThan(0);
        expect(comments[0].type).toBe('jsdoc');
    });

    it('skips non-code files', async () => {
        mockFetch(() => textResponse(''));
        const client = makeClient();
        const comments = await client.fetchCodeComments(['README.md', 'image.png'], 'main');
        expect(comments).toEqual([]);
    });

    it('limits to MAX_CODE_FILES (40)', async () => {
        let fetchCount = 0;
        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) {
                fetchCount++;
                return textResponse('// a short comment, nothing to see here really\nconst x = 1;');
            }
            return jsonResponse({});
        });

        const files = Array.from({ length: 50 }, (_, i) => `src/file${i}.js`);
        const client = makeClient();
        await client.fetchCodeComments(files, 'main');
        expect(fetchCount).toBeLessThanOrEqual(40);
    });

    it('handles failed file fetches gracefully', async () => {
        let callIndex = 0;
        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) {
                callIndex++;
                if (callIndex === 1) return textResponse('', 404);
                return textResponse('// This is a valid comment in the second file\nconst y = 2;');
            }
            return jsonResponse({});
        });

        const client = makeClient();
        const comments = await client.fetchCodeComments(['src/a.js', 'src/b.js'], 'main');
        expect(comments.length).toBeGreaterThan(0);
    });

    it('filters out short comments and eslint/ts directives', async () => {
        const code = [
            '// short',
            '// eslint-disable-next-line no-unused-vars',
            '// @ts-ignore',
            '// This is a real comment that should be kept around',
        ].join('\n');

        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) return textResponse(code);
            return jsonResponse({});
        });

        const client = makeClient();
        const comments = await client.fetchCodeComments(['src/index.js'], 'main');
        expect(comments).toHaveLength(1);
        expect(comments[0].text).toContain('real comment');
    });

    it('extracts Python-style comments', async () => {
        const code = '# This is an important Python comment about the module\nx = 1';

        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) return textResponse(code);
            return jsonResponse({});
        });

        const client = makeClient();
        const comments = await client.fetchCodeComments(['main.py'], 'main');
        expect(comments.length).toBeGreaterThan(0);
        expect(comments[0].text).toContain('Python comment');
    });

    it('extracts Python docstrings', async () => {
        const code = [
            '"""',
            'This module provides the core widget functionality for users.',
            '"""',
            'import os',
        ].join('\n');

        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) return textResponse(code);
            return jsonResponse({});
        });

        const client = makeClient();
        const comments = await client.fetchCodeComments(['main.py'], 'main');
        expect(comments.length).toBeGreaterThan(0);
        expect(comments[0].type).toBe('block');
    });
});

describe('fetchDependencies', () => {
    it('parses package.json dependencies', async () => {
        const pkg = JSON.stringify({
            dependencies: { react: '^18.0.0' },
            devDependencies: { jest: '^30.0.0' },
        });

        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) return textResponse(pkg);
            return jsonResponse({});
        });

        const client = makeClient();
        const deps = await client.fetchDependencies(['package.json', 'src/index.js'], 'main');
        expect(deps.runtime).toEqual({ react: '^18.0.0' });
        expect(deps.dev).toEqual({ jest: '^30.0.0' });
    });

    it('parses requirements.txt', async () => {
        const content = 'flask==2.0.0\nrequests>=2.28\n# a comment\nnumpy';

        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) return textResponse(content);
            return jsonResponse({});
        });

        const client = makeClient();
        const deps = await client.fetchDependencies(['requirements.txt'], 'main');
        expect(deps.runtime).toHaveProperty('flask');
        expect(deps.runtime).toHaveProperty('requests');
        expect(deps.runtime).toHaveProperty('numpy');
    });

    it('parses go.mod', async () => {
        const content = [
            'module example.com/widget',
            '',
            'require github.com/gin-gonic/gin v1.9.0',
            'require golang.org/x/text v0.14.0',
        ].join('\n');

        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) return textResponse(content);
            return jsonResponse({});
        });

        const client = makeClient();
        const deps = await client.fetchDependencies(['go.mod'], 'main');
        expect(deps.runtime['github.com/gin-gonic/gin']).toBe('v1.9.0');
    });

    it('returns empty deps when no dep file found', async () => {
        const client = makeClient();
        mockFetch(() => textResponse(''));
        const deps = await client.fetchDependencies(['src/index.js'], 'main');
        expect(deps.runtime).toEqual({});
        expect(deps.dev).toEqual({});
    });

    it('returns empty deps when fetch fails', async () => {
        mockFetch(() => textResponse('', 404));
        const client = makeClient();
        const deps = await client.fetchDependencies(['package.json'], 'main');
        expect(deps.runtime).toEqual({});
    });

    it('returns empty deps for unknown dep file format', async () => {
        mockFetch((url) => {
            if (url.includes('raw.githubusercontent.com')) return textResponse('some content');
            return jsonResponse({});
        });

        const client = makeClient();
        const deps = await client.fetchDependencies(['Gemfile'], 'main');
        expect(deps.runtime).toEqual({});
    });
});

describe('fetchAll', () => {
    it('orchestrates all fetches and returns combined data', async () => {
        mockFetch((url) => {
            if (url.includes('/repos/acme/widget') && !url.includes('readme') && !url.includes('trees')) {
                return jsonResponse({
                    description: 'A widget',
                    language: 'JavaScript',
                    stargazers_count: 10,
                    topics: [],
                    default_branch: 'main',
                    license: null,
                });
            }
            if (url.includes('readme')) {
                return jsonResponse({ content: Buffer.from('# Widget').toString('base64') });
            }
            if (url.includes('trees')) {
                return jsonResponse({ tree: [{ path: 'index.js', type: 'blob' }] });
            }
            if (url.includes('raw.githubusercontent.com')) {
                return textResponse('// A comment about the widget module itself\nconst x = 1;');
            }
            return jsonResponse({});
        });

        const client = makeClient();
        const result = await client.fetchAll();
        expect(result).toHaveProperty('meta');
        expect(result).toHaveProperty('readme');
        expect(result).toHaveProperty('codeComments');
        expect(result).toHaveProperty('dependencies');
        expect(result).toHaveProperty('fileTree');
        expect(result.meta.repo).toBe('widget');
        expect(result.readme).toBe('# Widget');
    });
});

describe('get', () => {
    it('throws on non-OK responses', async () => {
        mockFetch(() => jsonResponse({ message: 'Not Found' }, 404));
        const client = makeClient();
        await expect(client.get('/repos/acme/widget')).rejects.toThrow(/GitHub API 404/);
    });
});
