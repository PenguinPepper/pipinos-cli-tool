#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';

const program = new Command();

program
    .name('pipinos')
    .description('A lightweight command-line tool that automatically generates flashcards, cheat sheets, and diagrams from a project’s repository to help  teams onboard quickly.')
    .version('1.0.0');

program
    .command('generate')
    .description('Generate onboarding materials for repsitory')
    .argument('[repo-url]', 'Url of the repository you wish to understand')
    .option('-r, --repo <owner/repo>', 'Github repository to scan (defaults to the current directory git remote)')
    .option('-b, --branch <branch>', 'Branch to scan (defaults to default branch)')
    .option('-o', '--output', 'Output diretory for generated files')
    .action(async (repoUrl, options) => {
        try {
            console.log('Hre are your files')
        } catch (error) {
            console.error(`${error.message}`)
            process.exit(1)
        }
    })

program.parse();