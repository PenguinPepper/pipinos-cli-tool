import { describe, it, expect } from '@jest/globals';
import {
    parseMarkdown,
    parseRepo,
    findSection,
    allCodeBlocks,
    repoSummary,
} from '../commands/parser/markdown.js';

describe('parseMarkdown', () => {
    it('returns empty array for empty input', () => {
        expect(parseMarkdown('')).toEqual([]);
        expect(parseMarkdown('   ')).toEqual([]);
    });

    it('parses a single section with no heading as Overview', () => {
        const result = parseMarkdown('Some introductory text about the project.');
        expect(result).toHaveLength(1);
        expect(result[0].heading).toBe('Overview');
        expect(result[0].level).toBe(1);
        expect(result[0].content).toContain('introductory text');
    });

    it('parses multiple headings into separate sections', () => {
        const md = [
            '# Title',
            'Intro paragraph.',
            '## Installation',
            'Run npm install.',
            '## Usage',
            'Import the module.',
        ].join('\n');

        const result = parseMarkdown(md);
        expect(result).toHaveLength(3);
        expect(result[0].heading).toBe('Title');
        expect(result[0].level).toBe(1);
        expect(result[1].heading).toBe('Installation');
        expect(result[1].level).toBe(2);
        expect(result[1].content).toContain('npm install');
        expect(result[2].heading).toBe('Usage');
        expect(result[2].content).toContain('Import the module');
    });

    it('extracts code blocks with language', () => {
        const md = [
            '## Setup',
            'Install it:',
            '```bash',
            'npm install foo',
            '```',
        ].join('\n');

        const result = parseMarkdown(md);
        expect(result[0].codeBlocks).toHaveLength(1);
        expect(result[0].codeBlocks[0].language).toBe('bash');
        expect(result[0].codeBlocks[0].code).toBe('npm install foo');
    });

    it('defaults code block language to text', () => {
        const md = ['## Example', '```', 'some code', '```'].join('\n');
        const result = parseMarkdown(md);
        expect(result[0].codeBlocks[0].language).toBe('text');
    });

    it('handles tilde code fences', () => {
        const md = ['## Example', '~~~js', 'const x = 1;', '~~~'].join('\n');
        const result = parseMarkdown(md);
        expect(result[0].codeBlocks[0].language).toBe('js');
        expect(result[0].codeBlocks[0].code).toBe('const x = 1;');
    });

    it('strips markdown formatting from content', () => {
        const md = [
            '## Notes',
            '**bold text** and *italic* and `code`',
            '[a link](http://example.com)',
            '![an image](http://example.com/img.png)',
        ].join('\n');

        const result = parseMarkdown(md);
        expect(result[0].content).toContain('bold text');
        expect(result[0].content).toContain('italic');
        expect(result[0].content).toContain('code');
        expect(result[0].content).toContain('a link');
        expect(result[0].content).not.toContain('http://example.com');
        expect(result[0].content).not.toContain('![');
    });

    it('strips blockquote markers', () => {
        const md = ['## Notes', '> This is a quote.'].join('\n');
        const result = parseMarkdown(md);
        expect(result[0].content).toBe('This is a quote.');
    });

    it('strips list markers', () => {
        const md = ['## Notes', '- item one', '* item two', '1. item three'].join('\n');
        const result = parseMarkdown(md);
        expect(result[0].content).toContain('item one');
        expect(result[0].content).toContain('item two');
        expect(result[0].content).toContain('item three');
    });

    it('skips empty sections', () => {
        const md = ['# Title', '', '## Empty Section', '', '## Has Content', 'Some text.'].join('\n');
        const result = parseMarkdown(md);
        const headings = result.map((s) => s.heading);
        expect(headings).not.toContain('Empty Section');
        expect(headings).toContain('Has Content');
    });

    it('handles heading levels 1 through 6', () => {
        const md = [
            '# H1', 'text',
            '## H2', 'text',
            '### H3', 'text',
            '#### H4', 'text',
            '##### H5', 'text',
            '###### H6', 'text',
        ].join('\n');

        const result = parseMarkdown(md);
        expect(result.map((s) => s.level)).toEqual([1, 2, 3, 4, 5, 6]);
    });

    it('handles multiple code blocks in one section', () => {
        const md = [
            '## Examples',
            '```js',
            'const a = 1;',
            '```',
            'Then do:',
            '```python',
            'x = 2',
            '```',
        ].join('\n');

        const result = parseMarkdown(md);
        expect(result[0].codeBlocks).toHaveLength(2);
        expect(result[0].codeBlocks[0].language).toBe('js');
        expect(result[0].codeBlocks[1].language).toBe('python');
    });
});

describe('parseRepo', () => {
    it('passes through raw data and parses readme into sections', () => {
        const raw = {
            meta: { repo: 'test', owner: 'me' },
            readme: '# Title\nHello world.',
            codeComments: [{ text: 'a comment' }],
            dependencies: { runtime: {}, dev: {} },
            fileTree: ['src/index.js'],
        };

        const result = parseRepo(raw);
        expect(result.meta).toBe(raw.meta);
        expect(result.codeComments).toBe(raw.codeComments);
        expect(result.dependencies).toBe(raw.dependencies);
        expect(result.fileTree).toBe(raw.fileTree);
        expect(result.sections).toHaveLength(1);
        expect(result.sections[0].heading).toBe('Title');
    });
});

describe('findSection', () => {
    const sections = [
        { heading: 'Overview', content: 'intro' },
        { heading: 'Installation Guide', content: 'steps' },
        { heading: 'Usage Examples', content: 'examples' },
        { heading: 'Contributing', content: 'how to help' },
    ];

    it('finds section by keyword', () => {
        expect(findSection(sections, 'install')).toBe(sections[1]);
    });

    it('is case-insensitive', () => {
        expect(findSection(sections, 'USAGE')).toBe(sections[2]);
    });

    it('matches any of multiple keywords', () => {
        expect(findSection(sections, 'setup', 'install')).toBe(sections[1]);
    });

    it('returns undefined when no match', () => {
        expect(findSection(sections, 'nonexistent')).toBeUndefined();
    });
});

describe('allCodeBlocks', () => {
    it('collects code blocks from all sections', () => {
        const sections = [
            { codeBlocks: [{ language: 'js', code: 'a' }] },
            { codeBlocks: [{ language: 'py', code: 'b' }, { language: 'sh', code: 'c' }] },
            { codeBlocks: [] },
        ];

        const blocks = allCodeBlocks(sections);
        expect(blocks).toHaveLength(3);
        expect(blocks.map((b) => b.language)).toEqual(['js', 'py', 'sh']);
    });

    it('returns empty array for no sections', () => {
        expect(allCodeBlocks([])).toEqual([]);
    });
});

describe('repoSummary', () => {
    it('returns first line longer than 40 chars', () => {
        const sections = [
            { content: 'Short.\nAnother short line.' },
            { content: 'This is a much longer description line that definitely exceeds forty characters.' },
        ];
        expect(repoSummary(sections)).toBe(
            'This is a much longer description line that definitely exceeds forty characters.'
        );
    });

    it('returns empty string when no long lines exist', () => {
        const sections = [{ content: 'Short.' }];
        expect(repoSummary(sections)).toBe('');
    });

    it('returns empty string for empty sections', () => {
        expect(repoSummary([])).toBe('');
    });
});
