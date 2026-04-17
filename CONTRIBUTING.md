# Contributing to pipinos

Thanks for taking the time to contribute. pipinos is a small project and every bug report, fix, or feature proposal helps.

## Prerequisites

- Node.js 18 or higher
- npm (bundled with Node)
- A GitHub account

## Local setup

```bash
git clone https://github.com/PenguinPepper/pipinos-cli-tool.git
cd pipinos-cli-tool
npm install
```

Run the CLI straight from source:

```bash
node cli.js generate --repo facebook/react
```

For private repos or frequent runs, drop a `GITHUB_TOKEN` into a `.env` file at the project root (ignored by git):

```
GITHUB_TOKEN=ghp_your_classic_pat
```

## Branching

- `main` is the stable branch. Do not commit to it directly.
- Branch names should be short and descriptive, e.g. `fix/output-flag`, `feature/gitlab-support`, `docs/readme-cleanup`.

## Commits

- One logical change per commit. Keep them atomic.
- Subject line starts with a capital letter, no `feat:` / `fix:` / `chore:` prefixes.
- Keep subjects under ~70 characters. Use the body for the why, not the what.
- Do not add Co-Authored-By or tool-generated trailers.

Good examples:

```
Rename package to pipinos-cli and expose pipinos binary
Fix --output option so it accepts a directory argument
```

## Pull requests

1. Fork the repo and create a feature branch from `main`.
2. Make your changes with atomic commits.
3. Run the CLI locally against at least one public repo to confirm nothing regressed.
4. Open a PR against `main`. Fill in the PR template.
5. Link the related issue if one exists.

Expect a review within a few days. Small PRs get reviewed faster than large ones.

## Code style

- The project is ES modules only (`"type": "module"` in `package.json`). Use `import` / `export`, not `require`.
- Prefer clear variable names over comments. Only write a comment when the *why* is non-obvious.
- No emojis in source files or markdown unless there is a clear reason for one.

## Reporting issues

- Bugs: open an issue using the Bug Report template.
- Feature ideas: open an issue using the Feature Request template.
- Security vulnerabilities: follow the process in [SECURITY.md](SECURITY.md). Do not open a public issue.

## Code of conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
