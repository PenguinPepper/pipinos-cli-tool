const BASE = 'https://api.github.com';

const CODE_EXTENSIONS = [
    '.ts', '.tsx', '.js', '.jsx',
    '.py', '.go', '.rs', '.java',
    '.rb', '.php', '.cs', '.cpp', '.c',
];

const DEP_FILES = [
    'package.json',
    'requirements.txt',
    'Pipfile',
    'go.mod',
    'Cargo.toml',
    'pom.xml',
    'Gemfile',
];

const MAX_CODE_FILES = 40;

export class GitHubClient {
    constructor(cfg) {
        this.cfg = cfg;
        this.headers = {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            ...(cfg.token ? { Authorization: `Bearer ${cfg.token}` } : {}),
        };
    }

    async fetchAll() {
        const [meta, defaultBranch] = await this.fetchMeta();
        const branch = this.cfg.branch ?? defaultBranch;

        const [readme, fileTree] = await Promise.all([
            this.fetchReadme(),
            this.fetchFileTree(branch),
        ]);

        const [codeComments, dependencies] = await Promise.all([
            this.fetchCodeComments(fileTree, branch),
            this.fetchDependencies(fileTree, branch),
        ]);

        return { meta, readme, codeComments, dependencies, fileTree };
    }

    async fetchMeta() {
        const data = await this.get(`/repos/${this.cfg.owner}/${this.cfg.repo}`);

        const meta = {
            owner: this.cfg.owner,
            repo: this.cfg.repo,
            description: data.description ?? '',
            language: data.language ?? null,
            stars: data.stargazers_count,
            topics: data.topics ?? [],
            defaultBranch: data.default_branch,
            license: data.license?.name ?? null,
        };

        return [meta, data.default_branch];
    }

    async fetchReadme() {
        try {
            const data = await this.get(`/repos/${this.cfg.owner}/${this.cfg.repo}/readme`);
            return Buffer.from(data.content, 'base64').toString('utf-8');
        } catch {
            return '';
        }
    }

    async fetchFileTree(branch) {
        const data = await this.get(
            `/repos/${this.cfg.owner}/${this.cfg.repo}/git/trees/${branch}?recursive=1`
        );
        return (data.tree ?? [])
            .filter((f) => f.type === 'blob')
            .map((f) => f.path);
    }

    async fetchCodeComments(fileTree, branch) {
        const targets = fileTree
            .filter((p) => CODE_EXTENSIONS.some((ext) => p.endsWith(ext)))
            .slice(0, MAX_CODE_FILES);

        const results = await Promise.allSettled(
            targets.map((filePath) => this.extractCommentsFromFile(filePath, branch))
        );

        return results
            .filter((r) => r.status === 'fulfilled')
            .flatMap((r) => r.value);
    }

    async extractCommentsFromFile(filePath, branch) {
        const raw = await this.fetchRawFile(filePath, branch);
        if (!raw) return [];
        return parseComments(filePath, raw);
    }

    async fetchDependencies(fileTree, branch) {
        const empty = { runtime: {}, dev: {}, raw: {} };
        const depFile = DEP_FILES.find((f) => fileTree.includes(f));
        if (!depFile) return empty;

        const raw = await this.fetchRawFile(depFile, branch);
        if (!raw) return empty;

        return parseDependencies(depFile, raw);
    }

    async fetchRawFile(filePath, branch) {
        try {
            const url = `https://raw.githubusercontent.com/${this.cfg.owner}/${this.cfg.repo}/${branch}/${filePath}`;
            const res = await fetch(url, { headers: this.headers });
            if (!res.ok) return null;
            return res.text();
        } catch {
            return null;
        }
    }

    async get(path) {
        const res = await fetch(`${BASE}${path}`, { headers: this.headers });
        if (!res.ok) {
            const body = await res.text().catch(() => '');
            throw new Error(`GitHub API ${res.status} for ${path}: ${body.slice(0, 200)}`);
        }
        return res.json();
    }
}

//  Comment extractor

function parseComments(file, source) {
    const comments = [];
    const lines = source.split('\n');

    let inBlock = false;
    let blockLines = [];
    let blockStart = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!inBlock && (trimmed.startsWith('/*') || trimmed.startsWith('"""') || trimmed.startsWith("'''"))) {
            inBlock = true;
            blockStart = i + 1;
            blockLines = [trimmed];
            continue;
        }

        if (inBlock) {
            blockLines.push(trimmed);
            if (trimmed.endsWith('*/') || trimmed.endsWith('"""') || trimmed.endsWith("'''")) {
                const text = blockLines
                    .join(' ')
                    .replace(/\/\*\*?|\*\/|\*|"""|'''/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();

                if (text.length > 10) {
                    const isJsDoc = blockLines[0].trimStart().startsWith('/**');
                    comments.push({
                        file,
                        line: blockStart,
                        type: isJsDoc ? 'jsdoc' : 'block',
                        text,
                    });
                }
                inBlock = false;
                blockLines = [];
            }
            continue;
        }

        const singleMatch = trimmed.match(/^(?:\/\/|#|--)\s?(.+)$/);
        if (singleMatch) {
            const text = singleMatch[1].trim();
            if (text.length > 8 && !text.startsWith('eslint') && !text.startsWith('@ts-')) {
                comments.push({ file, line: i + 1, type: 'single', text });
            }
        }
    }

    return comments;
}

//  Dependency parser

function parseDependencies(filename, content) {
    try {
        if (filename === 'package.json') {
            const pkg = JSON.parse(content);
            return {
                runtime: pkg.dependencies ?? {},
                dev: pkg.devDependencies ?? {},
                raw: pkg,
            };
        }

        if (filename === 'requirements.txt') {
            const runtime = {};
            for (const line of content.split('\n')) {
                const clean = line.trim().replace(/#.*$/, '').trim();
                if (!clean) continue;
                const [name, version] = clean.split(/[=><~!]+/);
                if (name) runtime[name.trim()] = version?.trim() ?? '*';
            }
            return { runtime, dev: {}, raw: { requirementsTxt: content } };
        }

        if (filename === 'go.mod') {
            const runtime = {};
            for (const line of content.split('\n')) {
                const m = line.trim().match(/^(?:require\s+)?(\S+)\s+(v[\d.]+)/);
                if (m) runtime[m[1]] = m[2];
            }
            return { runtime, dev: {}, raw: { goMod: content } };
        }

        return { runtime: {}, dev: {}, raw: { raw: content } };
    } catch {
        return { runtime: {}, dev: {}, raw: {} };
    }
}