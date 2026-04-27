import { cleanup, render } from 'cli-testing-library';
import path from 'path';
import { describe, it, expect } from '@jest/globals';
import os from 'os';

const cli = path.resolve('./cli.js');
async function runCli(args = []) {
    try {
        const instance = await render('node', [cli, ...args]);
        await new Promise((r) => instance.process.on('exit', r));
        const stdout = instance.stdoutArr.map((e) => e.contents).join('\n');
        const stderr = instance.stderrArr.map((e) => e.contents).join('\n');
        const exit = instance.hasExit();
        return { stdout, stderr, exitCode: exit?.exitCode ?? null };
    }
    finally {
        cleanup();
    }
}

describe('test cli', () => {
    it('print version using --version', async () => {
        const { stdout, exitCode } = await runCli(['--version']);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toMatch(/1\.0\.0/);
    });

    it('print version using -V', async () => {
        const { stdout, exitCode } = await runCli(['-V']);
        expect(exitCode).toBe(0);
        expect(stdout.trim()).toMatch(/1\.0\.0/);
    });

    it('print help using --help', async () => {
        const { stdout, exitCode } = await runCli(['--help']);
        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/pipinos/);
    });

    it('prints generate help with generate --help', async () => {
        const { stdout, exitCode } = await runCli(['generate', '--help']);
        expect(exitCode).toBe(0);
        expect(stdout).toMatch(/--repo/);
        expect(stdout).toMatch(/--token/);
        expect(stdout).toMatch(/--branch/);
        expect(stdout).toMatch(/--output/);
        expect(stdout).toMatch(/--ai/);
    });

})

describe('test repo arguments', () => {
    it('exits when no --repo and no git remote is found', async () => {
        const { stderr, exitCode } = await runCli(['generate'], { HOME: os.tmpdir() });
        expect(exitCode).toBe(1);
        expect(stderr).toMatch(/Failed to fetch repository/i);
    });
})