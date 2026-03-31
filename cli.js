#!/usr/bin/env node

import { Command } from 'commander';
import { runGenerate } from './commands/generate.js';

const program = new Command();

program
    .name('pipinos')
    .description('A lightweight command-line tool that automatically generates flashcards, cheat sheets, and diagrams from a project’s repository to help  teams onboard quickly.')
    .version('1.0.0');

program
    .command('generate')
    .description('Generate onboarding materials for repsitory')
    .option('-r, --repo <owner/repo>', 'Github repository to scan (defaults to the current directory git remote)')
    .option('-t, --token <token>', 'Github personal access token')
    .option('-b, --branch <branch>', 'Branch to scan (defaults to default branch)')
    .option('-o', '--output', 'Output diretory for generated files')
    .option('--ai', 'Enrich output with Ai-powred summaries')
    .action(async (options) => {
        try {
            await runGenerate({
                repo: options.repo,
                token: options.token,
                branch: options.branch,
                output: options.output,
                ai: options.ai ?? false,
            });
        } catch (error) {
            console.error(`${error.message}`)
            process.exit(1)
        }
    })

program.configureOutput({
    outputError: (str, write) => write(`\n  ${str}\n`),
});

program.parseAsync(process.argv);
