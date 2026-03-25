#!/usr/bin/env node

import { Command } from 'commander';

const program = new Command();

program
    .name('pipinos')
    .description('A lightweight command-line tool that automatically generates flashcards, cheat sheets, and diagrams from a project’s repository to help  teams onboard quickly.')
    .version('1.0.0');

program.parse();