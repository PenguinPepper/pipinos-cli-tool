export function parseRepo(raw) {
    const sections = parseMarkdown(raw.readme);
    return {
        meta: raw.meta,
        sections,
        codeComments: raw.codeComments,
        dependencies: raw.dependencies,
        fileTree: raw.fileTree,
    };
}

export function parseMarkdown(markdown) {
    if (!markdown.trim()) return [];

    const lines = markdown.split('\n');
    const sections = [];

    let currentHeading = 'Overview';
    let currentLevel = 1;
    let contentLines = [];
    let inCodeBlock = false;
    let codeLang = '';
    let codeLines = [];
    const currentCodeBlocks = [];

    const flushSection = () => {
        const content = extractText(contentLines);
        if (content.trim() || currentCodeBlocks.length) {
            sections.push({
                heading: currentHeading,
                level: currentLevel,
                content: content.trim(),
                codeBlocks: [...currentCodeBlocks],
            });
        }
        contentLines = [];
        currentCodeBlocks.length = 0;
    };

    for (const line of lines) {
        if (line.startsWith('```') || line.startsWith('~~~')) {
            if (!inCodeBlock) {
                inCodeBlock = true;
                codeLang = line.replace(/^```|^~~~/, '').trim();
                codeLines = [];
            } else {
                currentCodeBlocks.push({
                    language: codeLang || 'text',
                    code: codeLines.join('\n'),
                });
                inCodeBlock = false;
                codeLang = '';
                codeLines = [];
            }
            continue;
        }

        if (inCodeBlock) {
            codeLines.push(line);
            continue;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushSection();
            currentLevel = headingMatch[1].length;
            currentHeading = headingMatch[2].trim();
            continue;
        }

        contentLines.push(line);
    }

    flushSection();
    return sections;
}

function extractText(lines) {
    return lines
        .map((line) =>
            line
                .replace(/`[^`]+`/g, (m) => m.replace(/`/g, '').trim())
                .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
                .replace(/_{1,3}([^_]+)_{1,3}/g, '$1')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
                .replace(/<[^>]+>/g, '')
                .replace(/^>\s?/, '')
                .replace(/^[\s]*[-*+]\s/, '')
                .replace(/^[\s]*\d+\.\s/, '')
                .trim()
        )
        .filter(Boolean)
        .join('\n');
}

export function findSection(sections, ...keywords) {
    const lower = keywords.map((k) => k.toLowerCase());
    return sections.find((s) =>
        lower.some((kw) => s.heading.toLowerCase().includes(kw))
    );
}

export function allCodeBlocks(sections) {
    return sections.flatMap((s) => s.codeBlocks);
}

export function repoSummary(sections) {
    for (const s of sections) {
        const first = s.content.split('\n').find((l) => l.trim().length > 40);
        if (first) return first.trim();
    }
    return '';
}