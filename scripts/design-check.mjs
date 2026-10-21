#!/usr/bin/env node
// Design checks for the frontend-anti-slop skill. No dependencies.
//   node scripts/design-check.mjs contrast "#1f2a24:#ffffff" "#5b6b63:#ffffff:large"
//   node scripts/design-check.mjs scan [dir ...]        (default: src)
// scan exits 1 on any banned pattern from docs/design-bans.md. To keep a true false positive,
// put "design-ok: <reason>" in a comment on that line or the line above, and list it under Found.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const [command = "", ...args] = process.argv.slice(2);

function channels(color) {
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!hex) throw new Error(`Not a hex color: ${color}`);
  const full =
    hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}
function luminance(color) {
  const [r, g, b] = channels(color).map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// "Light but not pure white": the cream/off-white test for hex, rgb(), hsl() and oklch().
function offWhite(value) {
  const v = value.trim().toLowerCase();
  let m;
  if ((m = /^#([0-9a-f]{3}|[0-9a-f]{6})\b/.exec(v))) {
    const c = channels(m[0]);
    return Math.min(...c) >= 0.9 && Math.min(...c) < 1;
  }
  if ((m = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(v))) {
    const c = [m[1], m[2], m[3]].map(Number);
    return Math.min(...c) >= 230 && Math.min(...c) < 255;
  }
  if ((m = /^hsla?\(\s*[\d.]+(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(v)))
    return Number(m[2]) >= 90 && Number(m[2]) < 100;
  if ((m = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)/.exec(v))) {
    const l = Number(m[1]) / (m[2] ? 100 : 1);
    return l >= 0.93 && !(l >= 0.999 && Number(m[3]) < 0.002);
  }
  return false;
}

if (command === "contrast") {
  if (args.length === 0)
    throw new Error('Usage: contrast "<fg>:<bg>[:large]" ...');
  let failed = 0;
  for (const pair of args) {
    const [fg, bg, size] = pair.split(":");
    const ratio =
      (Math.max(luminance(fg), luminance(bg)) + 0.05) /
      (Math.min(luminance(fg), luminance(bg)) + 0.05);
    const needed = size === "large" ? 3 : 4.5;
    if (ratio < needed) failed++;
    console.log(
      `${fg} on ${bg}: ${ratio.toFixed(2)}:1 ${ratio >= needed ? "PASS" : "FAIL"} (needs ${needed}:1${size === "large" ? ", large text or UI" : ""})`,
    );
  }
  process.exit(failed ? 1 : 0);
}

if (command !== "scan") {
  console.error(
    'Usage: node scripts/design-check.mjs contrast "<fg>:<bg>[:large]" ... | scan [dir ...]',
  );
  process.exit(2);
}

const EXTENSIONS = new Set([
  ".tsx",
  ".jsx",
  ".ts",
  ".js",
  ".css",
  ".scss",
  ".mdx",
  ".html",
]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  "__snapshots__",
]);
const BUTTONISH =
  /<(button|Button|Link|a)\b|role=["']button|buttonVariants|\bbtn\b|\bcta\b/;
const CODEISH = /<(code|pre|kbd|samp)\b|Code(Block)?\b/;
const LINE_RULES = [
  {
    id: "A1",
    what: "cream or off-white page background",
    test: (line) => {
      const token =
        /--(?:color-)?(?:bg|background|page|canvas|paper|base)\s*:\s*([^;]+)/.exec(
          line,
        );
      if (token && offWhite(token[1])) return true;
      if (
        /<(body|html|main)\b/.test(line) &&
        /\bbg-(?:stone|amber|orange|yellow|neutral|zinc|gray|slate|rose|lime)-(?:50|100)\b/.test(
          line,
        )
      )
        return true;
      const arbitrary =
        /\bbg-\[(#[0-9a-f]{3,6}|rgb[^\]]+|hsl[^\]]+|oklch[^\]]+)\]/i.exec(line);
      return Boolean(
        arbitrary &&
        /<(body|html|main)\b/.test(line) &&
        offWhite(arbitrary[1].replace(/_/g, " ")),
      );
    },
  },
  {
    id: "A3",
    what: '"01 / 02 / 03" numbered section label',
    test: (line) =>
      (/(?:["'`>{]\s*0[1-9]\s*(?:[/.·—–-]|<|["'`}]))|(?:\/\s*0[1-9]\s*[<"'`])/.test(
        line,
      ) &&
        !/\d{4}-0[1-9]|0[1-9]:\d\d/.test(line)) ||
      (/padStart\(\s*2\s*,\s*["'`]0["'`]\s*\)/.test(line) &&
        /\b(?:i|idx|index|n|step|section|num)\b\s*\+\s*1|\bindex\b|\bidx\b/.test(
          line,
        )),
  },
  {
    id: "A4",
    what: "monospace label (outside code, pre, kbd)",
    test: (line) =>
      /\bfont-mono\b|font-family:[^;]*mono|var\(--font-mono\)/i.test(line) &&
      !CODEISH.test(line),
  },
  {
    id: "A5",
    what: "pill-shaped button",
    test: (line, context) =>
      /\brounded-full\b|rounded-\[(?:9999|999|100|50)px\]|border-radius:\s*(?:9999|999|100|50)px|border-radius:\s*50vh/.test(
        line,
      ) && BUTTONISH.test(context),
  },
  {
    id: "B1",
    what: "purple, violet or indigo gradient",
    test: (line) =>
      /\b(?:from|via|to)-(?:purple|violet|indigo|fuchsia)-\d{2,3}\b/.test(
        line,
      ) ||
      (/gradient/i.test(line) &&
        /purple|violet|indigo|fuchsia|#7c3aed|#8b5cf6|#a855f7|#6366f1|#9333ea/i.test(
          line,
        )),
  },
  {
    id: "B3",
    what: "emoji used as an icon or label",
    test: (line, _context, file) =>
      /\.(tsx|jsx|mdx|html)$/.test(file) &&
      /\p{Extended_Pictographic}/u.test(
        line.replace(/\/\/.*$|\{\/\*.*?\*\/\}|[©®™↔-↙]/g, ""),
      ),
  },
  {
    id: "B4",
    what: "sparkle or magic-wand icon meaning AI",
    test: (line) =>
      /import\s*\{[^}]*\b(?:Sparkles?|WandSparkles|Wand2?|MagicWand|Stars|SparklesIcon|StarsIcon)\b[^}]*\}\s*from\s*["'](?:lucide-react|@heroicons\/react[^"']*|react-icons[^"']*|@phosphor-icons\/react|@tabler\/icons-react)["']/.test(
        line,
      ),
  },
  {
    id: "B5",
    what: "glassmorphism (translucent blurred card)",
    test: (line) =>
      /\bbackdrop-blur/.test(line) &&
      /\bbg-(?:white|black|slate-\d+|zinc-\d+|gray-\d+)\/\d+/.test(line),
  },
  {
    id: "B6",
    what: "uppercase letter-spaced eyebrow label",
    test: (line) =>
      /\buppercase\b/.test(line) &&
      /\btracking-(?:wide|wider|widest|\[0?\.\d+em\])\b/.test(line) &&
      /\btext-(?:xs|\[1[0-2]px\])\b/.test(line),
  },
  {
    id: "B7",
    what: "hover-scale effect",
    test: (line) =>
      /\bhover:scale-\d+|:hover[^{]*\{[^}]*transform:\s*scale/.test(line),
  },
  {
    id: "B8",
    what: "placeholder copy",
    test: (line) =>
      /lorem ipsum|\bjohn doe\b|\bjane doe\b|\bacme(?: inc| corp)?\b|example\.com|foo@bar/i.test(
        line,
      ),
  },
];
const BLOCK_RULES = [
  {
    id: "A2",
    what: "italic accent word in a heading",
    regex: /<h[1-6]\b[\s\S]*?<\/h[1-6]>/g,
    test: (block) => /<(em|i)\b|\bitalic\b|font-style:\s*italic/.test(block),
  },
  {
    id: "A2",
    what: "italic accent word in a heading (CSS)",
    regex: /h[1-6][^{}]*\b(?:em|i)\b[^{}]*\{[^}]*\}/g,
    test: (block) => /font-style:\s*italic/.test(block),
  },
];
const DEFAULT_FONTS = new Set([
  "Inter",
  "Roboto",
  "Open_Sans",
  "Arial",
  "Geist",
  "Geist_Mono",
  "Inter_Tight",
  "Roboto_Mono",
]);

function customRules() {
  if (!existsSync("docs/design-bans.md")) return [];
  return readFileSync("docs/design-bans.md", "utf8")
    .split("\n")
    .flatMap((line) => {
      const match =
        /^- (C\d+)\b.*?scan:\s*`([^`]+)`(?:\s+in:\s*`([^`]+)`)?/.exec(line);
      if (!match) return [];
      const regex = new RegExp(match[2], "i");
      // `in: path` bans a rejected look only under that path while the live code still uses it.
      const scope = match[3]?.replace(/\\/g, "/").replace(/\/+$/, "");
      const inScope = (file) =>
        !scope || `${file.replace(/\\/g, "/")}/`.startsWith(`${scope}/`);
      return [
        {
          id: match[1],
          what: line.replace(/^- C\d+\s*/, "").replace(/\s*scan:.*$/, ""),
          test: (text, _context, file) => inScope(file) && regex.test(text),
        },
      ];
    });
}

function files(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory())
      return SKIP_DIRS.has(name) ? [] : files(path);
    return EXTENSIONS.has(extname(name)) ? [path] : [];
  });
}

const roots = args.length ? args : ["src"];
const rules = [...LINE_RULES, ...customRules()];
const findings = [];
const allowed = (lines, index) =>
  /design-ok:/.test(lines[index]) ||
  (index > 0 && /design-ok:/.test(lines[index - 1]));
for (const file of roots.flatMap(files)) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, index) => {
    const context = lines.slice(Math.max(0, index - 3), index + 1).join("\n");
    for (const rule of rules) {
      if (rule.test(line, context, file) && !allowed(lines, index))
        findings.push({
          file,
          line: index + 1,
          ...rule,
          excerpt: line.trim().slice(0, 120),
        });
    }
  });
  for (const rule of BLOCK_RULES) {
    for (const match of text.matchAll(rule.regex)) {
      const index = text.slice(0, match.index).split("\n").length - 1;
      if (rule.test(match[0]) && !allowed(lines, index))
        findings.push({
          file,
          line: index + 1,
          ...rule,
          excerpt: lines[index].trim().slice(0, 120),
        });
    }
  }
  const fonts = [
    ...text.matchAll(
      /import\s*\{([^}]+)\}\s*from\s*["']next\/font\/google["']/g,
    ),
  ].flatMap((m) =>
    m[1]
      .split(",")
      .map((s) => s.trim().split(/\s+as\s+/)[0])
      .filter(Boolean),
  );
  if (fonts.length && fonts.every((font) => DEFAULT_FONTS.has(font))) {
    const index = lines.findIndex((line) => line.includes("next/font/google"));
    if (!allowed(lines, index))
      findings.push({
        file,
        line: index + 1,
        id: "B2",
        what: `only default typefaces (${fonts.join(", ")})`,
        excerpt: lines[index].trim(),
      });
  }
}

for (const f of findings)
  console.log(`${f.file}:${f.line}  [${f.id}] ${f.what}\n    ${f.excerpt}`);
console.log(
  findings.length
    ? `\n${findings.length} design ban violations. Fix them, or mark a true false positive with "design-ok: <reason>".`
    : "Design scan: no banned patterns found.",
);
process.exit(findings.length ? 1 : 0);
