import { cleanup, render } from 'cli-testing-library';
import path from 'path';
import os from 'os';
import { describe, it, expect } from '@jest/globals';
import { exitCode } from 'process';

const cli = path.resolve('./cli.js');
async function runCli(args = []) {
    try {
        const { stdout, stderr } = await render('node', [cli, ...args]);
        return { stdout, stderr };
    }
    finally {
        cleanup();
    }
}

describe('test cli', () => {
    it('print version using --version', async () => {
        const { stdout } = await runCli(['--version']);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toMatch(/1\.0\.0/);
    });

    it('print version using -v', async () => {
        const { stdout } = await runCli(['-v']);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toMatch(/1\.0\.0/);
    });

    it('print help using --help', async () => {
        const { stdout } = await runCli(['--help']);
        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/pipinos/);
    });

    it('prints generate help with generate --help', async () => {
        const { stdout, exitCode } = await runCLI(['generate', '--help']);
        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/--repo/);
        expect(stdout).toMatch(/--token/);
        expect(stdout).toMatch(/--branch/);
        expect(stdout).toMatch(/--output/);
        expect(stdout).toMatch(/--ai/);
    });

})