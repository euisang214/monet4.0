#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SOURCE_DIRS = ["src/app", "src/components"];
const CSS_FILES = ["src/styles/utilities-legacy.css", "src/styles/calendar.css"];
const ALLOWLIST_PATH = "scripts/ui/legacy-utility-allowlist.json";
const INLINE_STYLE_ALLOWLIST_PATH = "scripts/ui/inline-style-allowlist.json";
const DISALLOWED_BUTTON_IMPORT = /from\s+["']@\/components\/ui\/primitives\/Button\/Button["']/;

const WRITE_ALLOWLIST = process.argv.includes("--write-allowlist");
const SHOW_METRICS = process.argv.includes("--metrics");
const REPORT_UNUSED = process.argv.includes("--report-unused");

function walk(dirPath, out = []) {
    if (!fs.existsSync(dirPath)) return out;
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const nextPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            walk(nextPath, out);
            continue;
        }

        if (/\.(tsx|jsx|ts|js)$/.test(entry.name)) {
            out.push(nextPath);
        }
    }
    return out;
}

function normalizeCssClassToken(token) {
    return token
        .replace(/\\\\/g, "\\")
        .replace(/\\:/g, ":")
        .replace(/\\\./g, ".")
        .replace(/\\\[/g, "[")
        .replace(/\\\]/g, "]")
        .replace(/\\\//g, "/");
}

function splitClassTokens(value) {
    return value
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => /^[A-Za-z0-9_:/.[\]\\-]+$/.test(token));
}

function collectStringTokens(text, file, usage) {
    for (const token of splitClassTokens(text)) {
        const row = usage.get(token) ?? new Set();
        row.add(file);
        usage.set(token, row);
    }
}

function collectFromExpression(expression, file, usage) {
    if (!expression) return;

    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
        collectStringTokens(expression.text, file, usage);
        return;
    }

    if (ts.isTemplateExpression(expression)) {
        collectStringTokens(expression.head.text, file, usage);
        for (const span of expression.templateSpans) {
            collectFromExpression(span.expression, file, usage);
            collectStringTokens(span.literal.text, file, usage);
        }
        return;
    }

    if (ts.isConditionalExpression(expression)) {
        collectFromExpression(expression.whenTrue, file, usage);
        collectFromExpression(expression.whenFalse, file, usage);
        return;
    }

    if (ts.isBinaryExpression(expression)) {
        if (expression.operatorToken.kind === ts.SyntaxKind.PlusToken) {
            collectFromExpression(expression.left, file, usage);
            collectFromExpression(expression.right, file, usage);
            return;
        }

        if (
            expression.operatorToken.kind === ts.SyntaxKind.BarBarToken
            || expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        ) {
            collectFromExpression(expression.left, file, usage);
            collectFromExpression(expression.right, file, usage);
            return;
        }

        if (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
            collectFromExpression(expression.right, file, usage);
        }

        return;
    }

    if (ts.isParenthesizedExpression(expression) || ts.isAsExpression(expression) || ts.isTypeAssertionExpression(expression)) {
        collectFromExpression(expression.expression, file, usage);
        return;
    }

    if (ts.isArrayLiteralExpression(expression)) {
        for (const element of expression.elements) {
            collectFromExpression(element, file, usage);
        }
        return;
    }

    if (ts.isCallExpression(expression)) {
        collectFromExpression(expression.expression, file, usage);
        for (const arg of expression.arguments) {
            collectFromExpression(arg, file, usage);
        }
        return;
    }
}

function collectClassTokensFromFile(filePath, usage) {
    const sourceText = fs.readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

    function visit(node) {
        if (ts.isJsxAttribute(node) && node.name.text === "className" && node.initializer) {
            if (ts.isStringLiteral(node.initializer)) {
                collectStringTokens(node.initializer.text, filePath, usage);
            } else if (ts.isJsxExpression(node.initializer)) {
                collectFromExpression(node.initializer.expression, filePath, usage);
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
}

function getDefinedClasses() {
    const classes = new Set();
    const classRegex = new RegExp("\\.((?:\\\\:|\\\\.|\\\\\\[|\\\\\\]|\\\\/|[A-Za-z0-9_-])+)(?=[\\s:{>,]|$)", "g");

    for (const cssFile of CSS_FILES) {
        const cssPath = path.join(ROOT, cssFile);
        if (!fs.existsSync(cssPath)) continue;
        const css = fs.readFileSync(cssPath, "utf8");
        let match;
        while ((match = classRegex.exec(css)) !== null) {
            classes.add(normalizeCssClassToken(match[1]));
        }
    }

    return classes;
}

function toSortedArray(setLike) {
    return [...setLike].sort((a, b) => a.localeCompare(b));
}

function countInlineStyles(text) {
    return (text.match(/style=\{\{/g) ?? []).length;
}

const usage = new Map();
for (const sourceDir of SOURCE_DIRS) {
    const absSourceDir = path.join(ROOT, sourceDir);
    for (const filePath of walk(absSourceDir)) {
        collectClassTokensFromFile(filePath, usage);
    }
}

const definedClasses = getDefinedClasses();
const usedTokens = toSortedArray(new Set(usage.keys()));
const undefinedTokens = usedTokens.filter((token) => !definedClasses.has(token));
const unusedDefinedTokens = toSortedArray(
    new Set([...definedClasses].filter((token) => !usage.has(token)))
);

const allowlistFilePath = path.join(ROOT, ALLOWLIST_PATH);
const inlineStyleAllowlistPath = path.join(ROOT, INLINE_STYLE_ALLOWLIST_PATH);

if (WRITE_ALLOWLIST) {
    fs.mkdirSync(path.dirname(allowlistFilePath), { recursive: true });
    fs.writeFileSync(allowlistFilePath, `${JSON.stringify(usedTokens, null, 2)}\n`);
    console.log(`Wrote allowlist with ${usedTokens.length} tokens to ${ALLOWLIST_PATH}`);
}

if (!fs.existsSync(allowlistFilePath)) {
    console.error(`Missing ${ALLOWLIST_PATH}. Run: npm run ui:audit -- --write-allowlist`);
    process.exit(1);
}

const allowlist = new Set(JSON.parse(fs.readFileSync(allowlistFilePath, "utf8")));
const newLegacyTokens = usedTokens.filter((token) => !allowlist.has(token));
const inlineStyleAllowlist = fs.existsSync(inlineStyleAllowlistPath)
    ? new Set(JSON.parse(fs.readFileSync(inlineStyleAllowlistPath, "utf8")))
    : new Set();

const inlineStyleViolations = [];
let inlineStyleCount = 0;
for (const sourceDir of SOURCE_DIRS) {
    const absSourceDir = path.join(ROOT, sourceDir);
    for (const filePath of walk(absSourceDir)) {
        const text = fs.readFileSync(filePath, "utf8");
        const occurrences = countInlineStyles(text);
        inlineStyleCount += occurrences;

        const relativePath = path.relative(ROOT, filePath);
        if (occurrences > 0 && !inlineStyleAllowlist.has(relativePath)) {
            inlineStyleViolations.push(`${relativePath} (${occurrences})`);
        }
    }
}

const uiFormControlViolations = [];
const uiComponentDir = path.join(ROOT, "src/components/ui");
for (const filePath of walk(uiComponentDir)) {
    const text = fs.readFileSync(filePath, "utf8");
    const hasRawControlUtility = /<(input|select|textarea)\b[^>]*className\s*=\s*"[^"]+"/.test(text);
    if (hasRawControlUtility) {
        uiFormControlViolations.push(path.relative(ROOT, filePath));
    }
}

const disallowedButtonImportViolations = [];
for (const sourceDir of SOURCE_DIRS) {
    const absSourceDir = path.join(ROOT, sourceDir);
    for (const filePath of walk(absSourceDir)) {
        const text = fs.readFileSync(filePath, "utf8");
        if (DISALLOWED_BUTTON_IMPORT.test(text)) {
            disallowedButtonImportViolations.push(path.relative(ROOT, filePath));
        }
    }
}

if (SHOW_METRICS) {
    const globalsPath = path.join(ROOT, "src/app/globals.css");
    const globalsLines = fs.existsSync(globalsPath) ? fs.readFileSync(globalsPath, "utf8").split("\n").length : 0;

    console.log(`globals_css_lines=${globalsLines}`);
    console.log(`undefined_class_tokens=${undefinedTokens.length}`);
    console.log(`inline_style_occurrences=${inlineStyleCount}`);
    console.log(`unused_defined_class_tokens=${unusedDefinedTokens.length}`);
}

if (REPORT_UNUSED) {
    console.log(JSON.stringify(unusedDefinedTokens, null, 2));
}

if (undefinedTokens.length > 0) {
    console.error("Undefined class tokens found:");
    for (const token of undefinedTokens) {
        const files = toSortedArray(usage.get(token) ?? []);
        console.error(`- ${token}`);
        for (const file of files.slice(0, 5)) {
            console.error(`  - ${path.relative(ROOT, file)}`);
        }
    }
    process.exit(1);
}

if (newLegacyTokens.length > 0) {
    console.error("New legacy utility tokens were introduced (not in allowlist):");
    for (const token of newLegacyTokens) {
        const files = toSortedArray(usage.get(token) ?? []);
        console.error(`- ${token}`);
        for (const file of files.slice(0, 3)) {
            console.error(`  - ${path.relative(ROOT, file)}`);
        }
    }
    process.exit(1);
}

if (inlineStyleViolations.length > 0) {
    console.error("Inline styles found outside the allowlist:");
    for (const file of inlineStyleViolations) {
        console.error(`- ${file}`);
    }
    process.exit(1);
}

if (uiFormControlViolations.length > 0) {
    console.error("UI form controls must use shared primitives instead of raw utility class strings:");
    for (const file of uiFormControlViolations) {
        console.error(`- ${file}`);
    }
    process.exit(1);
}

if (disallowedButtonImportViolations.length > 0) {
    console.error("buttonVariants must be imported from @/components/ui/primitives/Button:");
    for (const file of disallowedButtonImportViolations) {
        console.error(`- ${file}`);
    }
    process.exit(1);
}

console.log(`ui:audit passed (checked ${usedTokens.length} class tokens).`);
