import { describe, it, expect, afterEach } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { writeOutputs } from '../commands/src/lib/writer.js';

let tmpDir;

async function makeTmpDir() {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pipinos-test-'));
    return tmpDir;
}

afterEach(async () => {
    if (tmpDir) {
        await fs.rm(tmpDir, { recursive: true, force: true });
        tmpDir = null;
    }
});

function makeOutput() {
    return {
        flashcards: [
            { question: 'What is foo?', answer: 'A library.', category: 'concept' },
            { question: 'How to install foo?', answer: 'npm install foo', category: 'setup' },
        ],
        diagram: 'graph TD\n  A --> B',
        cheatsheet: '# Cheat Sheet\n\nSome content.',
    };
}

describe('writeOutputs', () => {
    it('creates output directory if it does not exist', async () => {
        const dir = path.join(await makeTmpDir(), 'nested', 'output');
        await writeOutputs(makeOutput(), dir);
        const stat = await fs.stat(dir);
        expect(stat.isDirectory()).toBe(true);
    });

    it('writes all three files', async () => {
        const dir = await makeTmpDir();
        const result = await writeOutputs(makeOutput(), dir);

        expect(result.flashcardsPath).toBe(path.join(dir, 'flashcards.md'));
        expect(result.diagramPath).toBe(path.join(dir, 'diagram.mmd'));
        expect(result.cheatsheetPath).toBe(path.join(dir, 'cheatsheet.md'));

        const files = await fs.readdir(dir);
        expect(files).toContain('flashcards.md');
        expect(files).toContain('diagram.mmd');
        expect(files).toContain('cheatsheet.md');
    });

    it('writes diagram content verbatim', async () => {
        const dir = await makeTmpDir();
        const output = makeOutput();
        await writeOutputs(output, dir);

        const diagram = await fs.readFile(path.join(dir, 'diagram.mmd'), 'utf-8');
        expect(diagram).toBe(output.diagram);
    });

    it('writes cheatsheet content verbatim', async () => {
        const dir = await makeTmpDir();
        const output = makeOutput();
        await writeOutputs(output, dir);

        const cheatsheet = await fs.readFile(path.join(dir, 'cheatsheet.md'), 'utf-8');
        expect(cheatsheet).toBe(output.cheatsheet);
    });

    it('renders flashcards with heading and structure', async () => {
        const dir = await makeTmpDir();
        await writeOutputs(makeOutput(), dir);

        const content = await fs.readFile(path.join(dir, 'flashcards.md'), 'utf-8');
        expect(content).toContain('# Flashcards');
        expect(content).toContain('pipinos');
        expect(content).toContain('**Q:** What is foo?');
        expect(content).toContain('**A:** A library.');
        expect(content).toContain('**Q:** How to install foo?');
    });

    it('groups flashcards by category', async () => {
        const dir = await makeTmpDir();
        await writeOutputs(makeOutput(), dir);

        const content = await fs.readFile(path.join(dir, 'flashcards.md'), 'utf-8');
        expect(content).toContain('Concepts');
        expect(content).toContain('Setup');
    });

    it('includes card count at the end', async () => {
        const dir = await makeTmpDir();
        await writeOutputs(makeOutput(), dir);

        const content = await fs.readFile(path.join(dir, 'flashcards.md'), 'utf-8');
        expect(content).toContain('2 cards total');
    });

    it('handles empty flashcards array', async () => {
        const dir = await makeTmpDir();
        const output = { ...makeOutput(), flashcards: [] };
        await writeOutputs(output, dir);

        const content = await fs.readFile(path.join(dir, 'flashcards.md'), 'utf-8');
        expect(content).toContain('# Flashcards');
        expect(content).toContain('0 cards total');
    });

    it('overwrites existing files', async () => {
        const dir = await makeTmpDir();
        await writeOutputs(makeOutput(), dir);
        const output2 = { ...makeOutput(), diagram: 'graph LR\n  X --> Y' };
        await writeOutputs(output2, dir);

        const diagram = await fs.readFile(path.join(dir, 'diagram.mmd'), 'utf-8');
        expect(diagram).toBe('graph LR\n  X --> Y');
    });
});
