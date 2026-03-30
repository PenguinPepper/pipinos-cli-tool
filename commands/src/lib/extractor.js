import { findSection, allCodeBlocks, repoSummary } from '../../parser/markdown.js';

export function extract(parsed) {
    return {
        flashcards: generateFlashcards(parsed),
        diagram: generateDiagram(parsed),
        cheatsheet: generateCheatsheet(parsed),
    };
}

//  FLASHCARDS

function generateFlashcards(parsed) {
    const cards = [];

    cards.push({
        question: `What is ${parsed.meta.repo}?`,
        answer: parsed.meta.description || repoSummary(parsed.sections) || 'No description available.',
        category: 'concept',
    });

    if (parsed.meta.language) {
        cards.push({
            question: `What is the primary language used in ${parsed.meta.repo}?`,
            answer: parsed.meta.language,
            category: 'concept',
        });
    }

    const installSection = findSection(parsed.sections, 'install', 'setup', 'getting started', 'quick start');
    if (installSection) {
        const steps = installSection.content
            .split('\n')
            .filter((l) => l.trim().length > 0)
            .slice(0, 5)
            .join('\n');

        if (steps) {
            cards.push({
                question: `How do you install or set up ${parsed.meta.repo}?`,
                answer: steps,
                category: 'setup',
            });
        }

        for (const block of installSection.codeBlocks.slice(0, 2)) {
            if (['bash', 'sh', 'shell', 'zsh', ''].includes(block.language)) {
                cards.push({
                    question: `What is the setup command for ${parsed.meta.repo}?`,
                    answer: '```' + block.language + '\n' + block.code.trim() + '\n```',
                    category: 'setup',
                });
                break;
            }
        }
    }

    const usageSection = findSection(parsed.sections, 'usage', 'example', 'how to use');
    if (usageSection) {
        const summary = usageSection.content.split('\n').filter(Boolean).slice(0, 4).join('\n');
        if (summary) {
            cards.push({
                question: `How is ${parsed.meta.repo} used?`,
                answer: summary,
                category: 'workflow',
            });
        }

        for (const block of usageSection.codeBlocks.slice(0, 2)) {
            cards.push({
                question: `Show an example usage of ${parsed.meta.repo}.`,
                answer: '```' + block.language + '\n' + block.code.trim() + '\n```',
                category: 'workflow',
            });
        }
    }

    const archSection = findSection(parsed.sections, 'architecture', 'overview', 'how it works', 'design');
    if (archSection?.content) {
        cards.push({
            question: `How is ${parsed.meta.repo} architected?`,
            answer: archSection.content.split('\n').filter(Boolean).slice(0, 6).join('\n'),
            category: 'architecture',
        });
    }

    const runtimeDeps = Object.keys(parsed.dependencies.runtime);
    if (runtimeDeps.length > 0) {
        cards.push({
            question: `What are the main runtime dependencies of ${parsed.meta.repo}?`,
            answer: runtimeDeps.slice(0, 12).join(', '),
            category: 'dependency',
        });
    }

    const devDeps = Object.keys(parsed.dependencies.dev);
    if (devDeps.length > 0) {
        cards.push({
            question: `What dev/build tools does ${parsed.meta.repo} use?`,
            answer: devDeps.slice(0, 12).join(', '),
            category: 'dependency',
        });
    }

    const configSection = findSection(parsed.sections, 'config', 'configuration', 'environment', 'env');
    if (configSection?.content) {
        cards.push({
            question: `How is ${parsed.meta.repo} configured?`,
            answer: configSection.content.split('\n').filter(Boolean).slice(0, 6).join('\n'),
            category: 'setup',
        });
    }

    const contribSection = findSection(parsed.sections, 'contributing', 'contribute', 'development');
    if (contribSection?.content) {
        cards.push({
            question: `How can I contribute to ${parsed.meta.repo}?`,
            answer: contribSection.content.split('\n').filter(Boolean).slice(0, 5).join('\n'),
            category: 'workflow',
        });
    }

    const jsdocComments = parsed.codeComments
        .filter((c) => c.type === 'jsdoc' || c.type === 'block')
        .filter((c) => c.text.length > 30)
        .slice(0, 6);

    for (const comment of jsdocComments) {
        cards.push({
            question: `What does the code in \`${comment.file}\` (line ${comment.line}) describe?`,
            answer: comment.text,
            category: 'concept',
        });
    }

    if (parsed.meta.topics.length > 0) {
        cards.push({
            question: `What topics or tags describe ${parsed.meta.repo}?`,
            answer: parsed.meta.topics.join(', '),
            category: 'concept',
        });
    }

    return deduplicateCards(cards);
}

function deduplicateCards(cards) {
    const seen = new Set();
    return cards.filter((c) => {
        const key = c.question.toLowerCase().slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

//  MERMAID DIAGRAM

function generateDiagram(parsed) {
    const lines = ['graph TD'];
    const deps = Object.keys(parsed.dependencies.runtime);
    const { repo } = parsed.meta;

    const repoId = sanitizeId(repo);
    lines.push(`  ${repoId}["🗂 ${repo}"]`);

    const categories = categorizeDeps(deps);

    for (const [cat, members] of Object.entries(categories)) {
        if (members.length === 0) continue;
        const catId = sanitizeId(cat);
        lines.push(`  ${catId}["${cat}"]`);
        lines.push(`  ${repoId} --> ${catId}`);

        for (const dep of members.slice(0, 5)) {
            const depId = sanitizeId(dep);
            lines.push(`  ${catId} --> ${depId}["${dep}"]`);
        }
    }

    const topDirs = getTopLevelDirs(parsed.fileTree);
    if (topDirs.length > 0) {
        lines.push('');
        lines.push('  subgraph Structure["📁 Repository Structure"]');
        for (const dir of topDirs.slice(0, 6)) {
            const dirId = sanitizeId('dir_' + dir);
            lines.push(`    ${dirId}["/${dir}"]`);
        }
        lines.push('  end');
        lines.push(`  ${repoId} --> Structure`);
    }

    lines.push('');
    lines.push(`  style ${repoId} fill:#38BDF8,color:#0F172A,stroke:#0EA5E9`);
    lines.push('  classDef cat fill:#1E293B,color:#94A3B8,stroke:#334155');
    lines.push('  classDef dep fill:#0F172A,color:#CBD5E1,stroke:#1E293B');

    const catIds = Object.keys(categories)
        .filter((c) => categories[c].length > 0)
        .map(sanitizeId)
        .join(',');
    if (catIds) lines.push(`  class ${catIds} cat`);

    return lines.join('\n');
}

function categorizeDeps(deps) {
    const cats = {
        'UI / Frontend': [],
        'Testing': [],
        'Database': [],
        'HTTP / Networking': [],
        'Build / Tooling': [],
        'Utilities': [],
    };

    const rules = [
        [/react|vue|svelte|angular|next|nuxt|solid|astro|tailwind|css|styled/i, 'UI / Frontend'],
        [/jest|vitest|mocha|chai|cypress|playwright|testing|spec/i, 'Testing'],
        [/prisma|mongoose|sequelize|typeorm|knex|pg|mysql|redis|mongo|sql/i, 'Database'],
        [/axios|fetch|got|superagent|node-fetch|express|fastify|koa|hono|http/i, 'HTTP / Networking'],
        [/typescript|webpack|vite|rollup|esbuild|babel|eslint|prettier|tsx|tsc/i, 'Build / Tooling'],
    ];

    for (const dep of deps) {
        let placed = false;
        for (const [regex, cat] of rules) {
            if (regex.test(dep)) {
                cats[cat].push(dep);
                placed = true;
                break;
            }
        }
        if (!placed) cats['Utilities'].push(dep);
    }

    return cats;
}

function sanitizeId(s) {
    return s.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+/, '').replace(/_+$/, '');
}

function getTopLevelDirs(fileTree) {
    const dirs = new Set();
    for (const filePath of fileTree) {
        const parts = filePath.split('/');
        if (parts.length > 1) dirs.add(parts[0]);
    }
    return [...dirs].sort();
}

//  CHEAT SHEET

function generateCheatsheet(parsed) {
    const { meta, sections, dependencies, fileTree } = parsed;
    const lines = [];

    const h = (text, level = 2) => '#'.repeat(level) + ' ' + text;

    lines.push(h(`${meta.repo} — Developer Cheat Sheet`, 1));
    lines.push('');
    lines.push(`> Auto-generated by **pipinos** · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    lines.push('');

    if (meta.description) {
        lines.push(h('Overview'));
        lines.push(meta.description);
        if (meta.language) lines.push(`- **Language:** ${meta.language}`);
        if (meta.license) lines.push(`- **License:** ${meta.license}`);
        if (meta.topics.length) lines.push(`- **Topics:** ${meta.topics.join(', ')}`);
        lines.push('');
    }

    const installSection = findSection(sections, 'install', 'setup', 'getting started', 'quick start');
    if (installSection) {
        lines.push(h('Installation'));
        if (installSection.content) lines.push(installSection.content);
        for (const block of installSection.codeBlocks) {
            lines.push('```' + block.language);
            lines.push(block.code.trim());
            lines.push('```');
        }
        lines.push('');
    }

    const usageSection = findSection(sections, 'usage', 'example', 'how to use', 'getting started');
    if (usageSection && usageSection !== installSection) {
        lines.push(h('Usage'));
        if (usageSection.content) lines.push(usageSection.content);
        for (const block of usageSection.codeBlocks.slice(0, 3)) {
            lines.push('```' + block.language);
            lines.push(block.code.trim());
            lines.push('```');
        }
        lines.push('');
    }

    const configSection = findSection(sections, 'config', 'configuration', 'environment', 'env var');
    if (configSection) {
        lines.push(h('Configuration'));
        if (configSection.content) lines.push(configSection.content);
        for (const block of configSection.codeBlocks) {
            lines.push('```' + block.language);
            lines.push(block.code.trim());
            lines.push('```');
        }
        lines.push('');
    }

    const runtimeDeps = Object.entries(dependencies.runtime);
    if (runtimeDeps.length > 0) {
        lines.push(h('Runtime Dependencies'));
        lines.push('| Package | Version |');
        lines.push('|---------|---------|');
        for (const [name, version] of runtimeDeps.slice(0, 20)) {
            lines.push(`| \`${name}\` | ${version} |`);
        }
        lines.push('');
    }

    const devDeps = Object.entries(dependencies.dev);
    if (devDeps.length > 0) {
        lines.push(h('Dev Dependencies'));
        lines.push('| Package | Version |');
        lines.push('|---------|---------|');
        for (const [name, version] of devDeps.slice(0, 20)) {
            lines.push(`| \`${name}\` | ${version} |`);
        }
        lines.push('');
    }

    const topDirs = getTopLevelDirs(fileTree);
    if (topDirs.length > 0) {
        lines.push(h('Repository Structure'));
        lines.push('```');
        lines.push(meta.repo + '/');
        for (const dir of topDirs.slice(0, 10)) {
            const filesInDir = fileTree.filter((f) => f.startsWith(dir + '/')).length;
            lines.push(`├── ${dir}/   (${filesInDir} files)`);
        }
        lines.push('```');
        lines.push('');
    }

    const contribSection = findSection(sections, 'contributing', 'contribute');
    if (contribSection?.content) {
        lines.push(h('Contributing'));
        lines.push(contribSection.content.split('\n').slice(0, 8).join('\n'));
        lines.push('');
    }

    const bashBlocks = allCodeBlocks(sections).filter(
        (b) => ['bash', 'sh', 'shell', 'zsh'].includes(b.language) && b.code.trim().length > 0
    );

    if (bashBlocks.length > 0) {
        lines.push(h('Common Commands'));
        for (const block of bashBlocks.slice(0, 6)) {
            lines.push('```bash');
            lines.push(block.code.trim());
            lines.push('```');
            lines.push('');
        }
    }

    return lines.join('\n');
}