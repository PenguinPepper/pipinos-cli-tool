import { describe, it, expect } from '@jest/globals';
import { extract } from '../commands/src/lib/extractor.js';

function makeParsed(overrides = {}) {
    return {
        meta: {
            owner: 'acme',
            repo: 'widget',
            description: 'A widget library',
            language: 'JavaScript',
            stars: 42,
            topics: ['ui', 'components'],
            defaultBranch: 'main',
            license: 'MIT',
        },
        sections: [
            {
                heading: 'Overview',
                level: 1,
                content: 'Widget is a component library for building UIs.',
                codeBlocks: [],
            },
        ],
        codeComments: [],
        dependencies: {
            runtime: { react: '^18.0.0', lodash: '^4.17.21' },
            dev: { jest: '^30.0.0' },
            raw: {},
        },
        fileTree: ['src/index.js', 'src/components/Button.js', 'tests/button.test.js'],
        ...overrides,
    };
}

describe('extract', () => {
    it('returns flashcards, diagram, and cheatsheet', () => {
        const result = extract(makeParsed());
        expect(result).toHaveProperty('flashcards');
        expect(result).toHaveProperty('diagram');
        expect(result).toHaveProperty('cheatsheet');
        expect(Array.isArray(result.flashcards)).toBe(true);
        expect(typeof result.diagram).toBe('string');
        expect(typeof result.cheatsheet).toBe('string');
    });
});

describe('flashcards', () => {
    it('generates a "what is" card from description', () => {
        const { flashcards } = extract(makeParsed());
        const whatIs = flashcards.find((c) => c.question.includes('What is widget'));
        expect(whatIs).toBeDefined();
        expect(whatIs.answer).toContain('widget library');
        expect(whatIs.category).toBe('concept');
    });

    it('generates a primary language card', () => {
        const { flashcards } = extract(makeParsed());
        const lang = flashcards.find((c) => c.question.includes('primary language'));
        expect(lang).toBeDefined();
        expect(lang.answer).toBe('JavaScript');
    });

    it('skips language card when language is null', () => {
        const { flashcards } = extract(makeParsed({ meta: { ...makeParsed().meta, language: null } }));
        const lang = flashcards.find((c) => c.question.includes('primary language'));
        expect(lang).toBeUndefined();
    });

    it('generates runtime dependency card', () => {
        const { flashcards } = extract(makeParsed());
        const deps = flashcards.find((c) => c.question.includes('runtime dependencies'));
        expect(deps).toBeDefined();
        expect(deps.answer).toContain('react');
        expect(deps.answer).toContain('lodash');
    });

    it('generates dev dependency card', () => {
        const { flashcards } = extract(makeParsed());
        const deps = flashcards.find((c) => c.question.includes('dev/build tools'));
        expect(deps).toBeDefined();
        expect(deps.answer).toContain('jest');
    });

    it('generates topics card', () => {
        const { flashcards } = extract(makeParsed());
        const topics = flashcards.find((c) => c.question.includes('topics'));
        expect(topics).toBeDefined();
        expect(topics.answer).toContain('ui');
        expect(topics.answer).toContain('components');
    });

    it('skips topics card when topics are empty', () => {
        const { flashcards } = extract(makeParsed({ meta: { ...makeParsed().meta, topics: [] } }));
        const topics = flashcards.find((c) => c.question.includes('topics'));
        expect(topics).toBeUndefined();
    });

    it('generates install card from install section', () => {
        const parsed = makeParsed({
            sections: [
                {
                    heading: 'Installation',
                    level: 2,
                    content: 'Run the following to install the package.\nnpm install widget',
                    codeBlocks: [{ language: 'bash', code: 'npm install widget' }],
                },
            ],
        });
        const { flashcards } = extract(parsed);
        const install = flashcards.find((c) => c.question.includes('install'));
        expect(install).toBeDefined();
    });

    it('generates usage card from usage section', () => {
        const parsed = makeParsed({
            sections: [
                {
                    heading: 'Usage',
                    level: 2,
                    content: 'Import the module and call render.\nPass your config object.',
                    codeBlocks: [{ language: 'js', code: "import widget from 'widget';" }],
                },
            ],
        });
        const { flashcards } = extract(parsed);
        const usage = flashcards.find((c) => c.question.includes('used'));
        expect(usage).toBeDefined();
    });

    it('generates architecture card from architecture section', () => {
        const parsed = makeParsed({
            sections: [
                {
                    heading: 'Architecture',
                    level: 2,
                    content: 'The system uses a component-based approach with a virtual DOM.',
                    codeBlocks: [],
                },
            ],
        });
        const { flashcards } = extract(parsed);
        const arch = flashcards.find((c) => c.question.includes('architected'));
        expect(arch).toBeDefined();
        expect(arch.category).toBe('architecture');
    });

    it('generates cards from jsdoc comments', () => {
        const parsed = makeParsed({
            codeComments: [
                { file: 'src/index.js', line: 5, type: 'jsdoc', text: 'Initializes the widget framework with the given configuration options' },
            ],
        });
        const { flashcards } = extract(parsed);
        const jsdoc = flashcards.find((c) => c.question.includes('src/index.js'));
        expect(jsdoc).toBeDefined();
        expect(jsdoc.answer).toContain('Initializes the widget framework');
    });

    it('deduplicates cards with similar questions', () => {
        const parsed = makeParsed({
            sections: [
                {
                    heading: 'Usage',
                    level: 2,
                    content: 'Use it like this.\nFirst configure.',
                    codeBlocks: [
                        { language: 'js', code: 'import foo;' },
                        { language: 'js', code: 'import bar;' },
                    ],
                },
            ],
        });
        const { flashcards } = extract(parsed);
        const exampleCards = flashcards.filter((c) => c.question.includes('example usage'));
        expect(exampleCards.length).toBeLessThanOrEqual(1);
    });

    it('generates contributing card from contributing section', () => {
        const parsed = makeParsed({
            sections: [
                {
                    heading: 'Contributing',
                    level: 2,
                    content: 'Fork the repo and submit a pull request.',
                    codeBlocks: [],
                },
            ],
        });
        const { flashcards } = extract(parsed);
        const contrib = flashcards.find((c) => c.question.includes('contribute'));
        expect(contrib).toBeDefined();
        expect(contrib.category).toBe('workflow');
    });

    it('generates config card from configuration section', () => {
        const parsed = makeParsed({
            sections: [
                {
                    heading: 'Configuration',
                    level: 2,
                    content: 'Set the WIDGET_TOKEN environment variable.',
                    codeBlocks: [],
                },
            ],
        });
        const { flashcards } = extract(parsed);
        const config = flashcards.find((c) => c.question.includes('configured'));
        expect(config).toBeDefined();
    });
});

describe('diagram', () => {
    it('starts with graph TD', () => {
        const { diagram } = extract(makeParsed());
        expect(diagram.startsWith('graph TD')).toBe(true);
    });

    it('contains repo name', () => {
        const { diagram } = extract(makeParsed());
        expect(diagram).toContain('widget');
    });

    it('categorizes UI dependencies', () => {
        const parsed = makeParsed({
            dependencies: { runtime: { react: '^18.0.0' }, dev: {}, raw: {} },
        });
        const { diagram } = extract(parsed);
        expect(diagram).toContain('UI / Frontend');
        expect(diagram).toContain('react');
    });

    it('categorizes testing dependencies', () => {
        const parsed = makeParsed({
            dependencies: { runtime: { jest: '^30.0.0' }, dev: {}, raw: {} },
        });
        const { diagram } = extract(parsed);
        expect(diagram).toContain('Testing');
    });

    it('categorizes database dependencies', () => {
        const parsed = makeParsed({
            dependencies: { runtime: { prisma: '^5.0.0' }, dev: {}, raw: {} },
        });
        const { diagram } = extract(parsed);
        expect(diagram).toContain('Database');
    });

    it('categorizes HTTP dependencies', () => {
        const parsed = makeParsed({
            dependencies: { runtime: { express: '^4.0.0' }, dev: {}, raw: {} },
        });
        const { diagram } = extract(parsed);
        expect(diagram).toContain('HTTP / Networking');
    });

    it('categorizes build dependencies', () => {
        const parsed = makeParsed({
            dependencies: { runtime: { typescript: '^5.0.0' }, dev: {}, raw: {} },
        });
        const { diagram } = extract(parsed);
        expect(diagram).toContain('Build / Tooling');
    });

    it('puts uncategorized deps in Utilities', () => {
        const parsed = makeParsed({
            dependencies: { runtime: { lodash: '^4.0.0' }, dev: {}, raw: {} },
        });
        const { diagram } = extract(parsed);
        expect(diagram).toContain('Utilities');
        expect(diagram).toContain('lodash');
    });

    it('includes repository structure subgraph', () => {
        const { diagram } = extract(makeParsed());
        expect(diagram).toContain('Structure');
        expect(diagram).toContain('src');
        expect(diagram).toContain('tests');
    });

    it('handles empty file tree without structure subgraph', () => {
        const { diagram } = extract(makeParsed({ fileTree: ['root-file.js'] }));
        expect(diagram).not.toContain('subgraph Structure');
    });

    it('includes styling', () => {
        const { diagram } = extract(makeParsed());
        expect(diagram).toContain('style');
        expect(diagram).toContain('classDef');
    });
});

describe('cheatsheet', () => {
    it('starts with repo name heading', () => {
        const { cheatsheet } = extract(makeParsed());
        expect(cheatsheet).toMatch(/^# widget/);
    });

    it('includes pipinos attribution', () => {
        const { cheatsheet } = extract(makeParsed());
        expect(cheatsheet).toContain('pipinos');
    });

    it('includes overview with description', () => {
        const { cheatsheet } = extract(makeParsed());
        expect(cheatsheet).toContain('A widget library');
    });

    it('includes language and license metadata', () => {
        const { cheatsheet } = extract(makeParsed());
        expect(cheatsheet).toContain('JavaScript');
        expect(cheatsheet).toContain('MIT');
    });

    it('includes runtime dependency table', () => {
        const { cheatsheet } = extract(makeParsed());
        expect(cheatsheet).toContain('Runtime Dependencies');
        expect(cheatsheet).toContain('react');
        expect(cheatsheet).toContain('^18.0.0');
    });

    it('includes dev dependency table', () => {
        const { cheatsheet } = extract(makeParsed());
        expect(cheatsheet).toContain('Dev Dependencies');
        expect(cheatsheet).toContain('jest');
    });

    it('includes repository structure', () => {
        const { cheatsheet } = extract(makeParsed());
        expect(cheatsheet).toContain('Repository Structure');
        expect(cheatsheet).toContain('src/');
    });

    it('includes install section when present', () => {
        const parsed = makeParsed({
            sections: [
                {
                    heading: 'Installation',
                    level: 2,
                    content: 'Run npm install widget.',
                    codeBlocks: [{ language: 'bash', code: 'npm install widget' }],
                },
            ],
        });
        const { cheatsheet } = extract(parsed);
        expect(cheatsheet).toContain('Installation');
        expect(cheatsheet).toContain('npm install widget');
    });

    it('includes bash commands in Common Commands section', () => {
        const parsed = makeParsed({
            sections: [
                {
                    heading: 'Usage',
                    level: 2,
                    content: 'Run the server:',
                    codeBlocks: [{ language: 'bash', code: 'npm start' }],
                },
            ],
        });
        const { cheatsheet } = extract(parsed);
        expect(cheatsheet).toContain('Common Commands');
        expect(cheatsheet).toContain('npm start');
    });

    it('skips empty optional sections gracefully', () => {
        const parsed = makeParsed({
            sections: [],
            dependencies: { runtime: {}, dev: {}, raw: {} },
            fileTree: ['file.txt'],
        });
        const { cheatsheet } = extract(parsed);
        expect(cheatsheet).toBeDefined();
        expect(cheatsheet).not.toContain('Installation');
        expect(cheatsheet).not.toContain('Runtime Dependencies');
    });
});
