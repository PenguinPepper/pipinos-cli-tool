import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import { execSync } from 'child_process';
import { GitHubClient } from './src/lib/github.js';
import { parseRepo } from './parser/markdown.js';
import { extract } from './src/lib/extractor.js';
import { writeOutputs } from './src/lib/writer.js';


export async function runGenerate(opts) {
    // Resolve target repo 
    const repoArg = opts.repo ?? inferRepoFromGit();

    if (!repoArg) {
        console.error(chalk.red('\n  ✖ No repo specified.'));
        console.error(chalk.dim('    Run inside a cloned repo, or use: pipinos generate --repo owner/repo\n'));
        process.exit(1);
    }

    const [owner, repo] = repoArg.split('/');
    if (!owner || !repo) {
        console.error(chalk.red(`\n  ✖ Invalid repo format: "${repoArg}". Use owner/repo\n`));
        process.exit(1);
    }

    const outputDir = path.resolve(opts.output ?? './pipinos');

    const cfg = {
        owner,
        repo,
        token: opts.token ?? process.env.GITHUB_TOKEN,
        branch: opts.branch,
        outputDir,
    };

    // Pipeline 
    console.log('');
    console.log(chalk.cyan('  ✦ pipinos') + chalk.dim(' — onboarding, automated'));
    console.log('');

    // Fetch
    const fetchSpinner = ora({
        text: chalk.dim(`  Connecting to ${chalk.white(repoArg)}…`),
        prefixText: ' ',
    }).start();

    let raw;
    try {
        const client = new GitHubClient(cfg);
        raw = await client.fetchAll();
        fetchSpinner.succeed(
            chalk.green('  ✓ Repository fetched') +
            chalk.dim(` · ${raw.codeComments.length} comments · ${raw.fileTree.length} files`)
        );
    } catch (err) {
        fetchSpinner.fail(chalk.red('  ✖ Failed to fetch repository'));
        console.error(chalk.dim(`    ${(err).message}\n`));
        process.exit(1);
    }

    // Parse
    const parseSpinner = ora({
        text: chalk.dim('  Parsing README and code comments…'),
        prefixText: ' ',
    }).start();

    const parsed = parseRepo(raw);
    parseSpinner.succeed(
        chalk.green('  ✓ Parsed') +
        chalk.dim(` · ${parsed.sections.length} README sections`)
    );

    // Extract
    const extractSpinner = ora({
        text: chalk.dim('  Extracting flashcards, diagram, cheat sheet…'),
        prefixText: ' ',
    }).start();

    const generated = extract(parsed);
    extractSpinner.succeed(
        chalk.green('  ✓ Generated') +
        chalk.dim(
            ` · ${generated.flashcards.length} flashcards · diagram · cheat sheet`
        )
    );

    // Write
    const writeSpinner = ora({
        text: chalk.dim(`  Writing to ${outputDir}…`),
        prefixText: ' ',
    }).start();

    const result = await writeOutputs(generated, outputDir);
    writeSpinner.succeed(chalk.green('  ✓ Saved'));

    // Summary 
    console.log('');
    console.log(chalk.dim('  ┌─────────────────────────────────────────'));
    console.log(chalk.dim('  │') + '  ' + chalk.bold.white('Output files'));
    console.log(chalk.dim('  │'));
    console.log(chalk.dim('  │  ') + chalk.magenta('flashcards') + chalk.dim(' →  ') + chalk.white(result.flashcardsPath));
    console.log(chalk.dim('  │  ') + chalk.magenta('diagram   ') + chalk.dim(' →  ') + chalk.white(result.diagramPath));
    console.log(chalk.dim('  │  ') + chalk.magenta('cheatsheet') + chalk.dim(' →  ') + chalk.white(result.cheatsheetPath));
    console.log(chalk.dim('  │'));
    console.log(chalk.dim('  │  ') + chalk.cyan('localhost:4200/pipinos') + chalk.dim('  (coming soon)'));
    console.log(chalk.dim('  └─────────────────────────────────────────'));
    console.log('');
}

//  Infer owner/repo from local git remote

function inferRepoFromGit() {
    try {
        const remote = execSync('git remote get-url origin', { stdio: ['pipe', 'pipe', 'pipe'] })
            .toString()
            .trim();

        // SSH: git@github.com:owner/repo.git
        const ssh = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
        if (ssh) return ssh[1];

        // HTTPS: https://github.com/owner/repo.git
        const https = remote.match(/github\.com\/(.+?)(?:\.git)?$/);
        if (https) return https[1];
    } catch {
        return null;
    }
    return null;
}