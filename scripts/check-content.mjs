// 記事（src/content 配下の .md / .mdx）に不正な埋め込みが含まれていないかをビルド前に検査する。
// コードブロック（``` / ~~~ で囲まれた部分）の中は対象外。
// 違反があればファイル名と行番号を出力して exit 1 で終了する。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = path.join(ROOT, 'src', 'content');
const ALLOWED_IMPORT_PREFIX = '../../components/';

const RULES = [
  { name: '<script> タグ', re: /<script\b/i },
  { name: '<iframe> タグ', re: /<iframe\b/i },
  { name: '<object> タグ', re: /<object\b/i },
  { name: '<embed> タグ', re: /<embed\b/i },
  { name: '<form> タグ', re: /<form\b/i },
  { name: 'イベントハンドラ属性 (on〇〇=)', re: /(?:^|[\s"'\/<])on[a-z]+\s*=/i },
  { name: 'javascript: URL', re: /javascript\s*:/i },
  { name: 'http:// のリンク（https:// を使うこと）', re: /http:\/\//i },
];

function listFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(p));
    else if (/\.mdx?$/.test(entry.name)) out.push(p);
  }
  return out;
}

function checkFile(file) {
  const errors = [];
  const isMdx = file.endsWith('.mdx');
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  let fence = null; // 開いているコードフェンス（例: '```'）

  lines.forEach((line, i) => {
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);
    if (fence) {
      // 開始と同じ文字・同じ長さ以上のフェンスのみで閉じる
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length
          && line.trim() === fenceMatch[1]) {
        fence = null;
      }
      return;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      return;
    }

    for (const rule of RULES) {
      if (rule.re.test(line)) errors.push({ line: i + 1, rule: rule.name, text: line.trim() });
    }

    if (isMdx && /^\s*import\b/.test(line)) {
      const from = line.match(/\bfrom\s+['"]([^'"]+)['"]/) ?? line.match(/^\s*import\s+['"]([^'"]+)['"]/);
      if (!from || !from[1].startsWith(ALLOWED_IMPORT_PREFIX) || from[1].includes('/../', ALLOWED_IMPORT_PREFIX.length - 1)) {
        errors.push({ line: i + 1, rule: `${ALLOWED_IMPORT_PREFIX} 以外からの import`, text: line.trim() });
      }
    }
  });

  if (fence) errors.push({ line: lines.length, rule: '閉じられていないコードブロック', text: fence });
  return errors;
}

let total = 0;
const files = listFiles(CONTENT_DIR);
for (const file of files) {
  for (const e of checkFile(file)) {
    total++;
    console.error(`${path.relative(ROOT, file)}:${e.line}: ${e.rule}\n    ${e.text}`);
  }
}

if (total > 0) {
  console.error(`\n[check-content] ${total} 件の問題が見つかりました。`);
  process.exit(1);
}
console.log(`[check-content] OK (${files.length} files)`);
