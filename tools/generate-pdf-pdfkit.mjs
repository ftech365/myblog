import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, 'blog-architecture.pdf');

// Colors matching the blog palette
const C = {
  bg:       '#080c14',
  bg2:      '#0d1220',
  surface:  '#151d2e',
  border:   '#1e2d47',
  accent:   '#00e5ff',
  accent2:  '#7c3aed',
  accent3:  '#f59e0b',
  text:     '#e2e8f0',
  textDim:  '#94a3b8',
  textMuted:'#64748b',
  green:    '#4ade80',
  white:    '#ffffff',
};

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 40, bottom: 40, left: 50, right: 50 },
  info: {
    Title: 'インフラ技術ブログ — アーキテクチャ解説',
    Author: 'Claude Code',
    Subject: 'Astro + Decap CMS + GitHub Pages 構成図',
  },
});

doc.pipe(fs.createWriteStream(outPath));

// Helper: fill page background
function pageBg() {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
}

// Helper: section box
function sectionBox(x, y, w, h, fillColor, label) {
  const [r, g, b] = hexToRgb(fillColor);
  doc.roundedRect(x, y, w, h, 6).fillColor(fillColor).fillOpacity(0.15).fill();
  doc.roundedRect(x, y, w, h, 6).strokeColor(fillColor).strokeOpacity(0.6).lineWidth(1).stroke();
  if (label) {
    doc.fontSize(8).font('Helvetica').fillColor(fillColor).fillOpacity(1)
       .text(label, x + 8, y + 6);
  }
}

// Helper: arrow (horizontal right)
function arrowRight(x, y, len, color = C.accent) {
  doc.moveTo(x, y).lineTo(x + len - 8, y)
     .strokeColor(color).strokeOpacity(0.8).lineWidth(1.5).stroke();
  doc.polygon([x + len - 8, y - 4], [x + len, y], [x + len - 8, y + 4])
     .fillColor(color).fillOpacity(0.8).fill();
}

// Helper: arrow (vertical down)
function arrowDown(x, y, len, color = C.accent) {
  doc.moveTo(x, y).lineTo(x, y + len - 8)
     .strokeColor(color).strokeOpacity(0.8).lineWidth(1.5).stroke();
  doc.polygon([x - 4, y + len - 8], [x, y + len], [x + 4, y + len - 8])
     .fillColor(color).fillOpacity(0.8).fill();
}

// Helper: node box
function nodeBox(x, y, w, h, fillHex, strokeHex, label, sublabel) {
  doc.roundedRect(x, y, w, h, 5).fillColor(fillHex).fillOpacity(0.9).fill();
  doc.roundedRect(x, y, w, h, 5).strokeColor(strokeHex).strokeOpacity(0.9).lineWidth(1.5).stroke();
  doc.fillColor(C.text).fillOpacity(1).fontSize(9).font('Helvetica-Bold')
     .text(label, x, y + (sublabel ? h / 2 - 12 : h / 2 - 6), { width: w, align: 'center' });
  if (sublabel) {
    doc.fillColor(C.textDim).fontSize(7).font('Helvetica')
       .text(sublabel, x, y + h / 2 + 2, { width: w, align: 'center' });
  }
}

// ─────────────────────────────────────────────
// PAGE 1: Cover
// ─────────────────────────────────────────────
pageBg();

// Top accent bar
doc.rect(0, 0, doc.page.width, 4).fillColor(C.accent).fillOpacity(1).fill();

// Title area
const cx = doc.page.width / 2;
doc.fillColor(C.accent).fillOpacity(1).fontSize(10).font('Helvetica')
   .text('// ARCHITECTURE DOCUMENT', 0, 100, { align: 'center' });

doc.fillColor(C.text).fontSize(32).font('Helvetica-Bold')
   .text('インフラ技術ブログ', 0, 125, { align: 'center' });
doc.fillColor(C.accent2).fontSize(14).font('Helvetica')
   .text('アーキテクチャ解説', 0, 168, { align: 'center' });

// Horizontal divider
doc.moveTo(100, 200).lineTo(doc.page.width - 100, 200)
   .strokeColor(C.border).strokeOpacity(1).lineWidth(1).stroke();
doc.moveTo(100, 200).lineTo(200, 200)
   .strokeColor(C.accent).strokeOpacity(1).lineWidth(2).stroke();

// Tech stack badges
const badges = [
  ['Astro v5',       C.accent],
  ['Tailwind CSS v4',C.accent2],
  ['Pagefind',       C.accent3],
  ['Decap CMS',      C.green],
  ['GitHub Pages',   C.accent],
  ['GitHub Actions', C.accent2],
];
const bw = 100, bh = 26, bGap = 14;
const totalW = badges.length * bw + (badges.length - 1) * bGap;
let bx = (doc.page.width - totalW) / 2;
const by = 230;
for (const [label, color] of badges) {
  const [r, g, b] = hexToRgb(color);
  doc.roundedRect(bx, by, bw, bh, 4).fillColor(color).fillOpacity(0.12).fill();
  doc.roundedRect(bx, by, bw, bh, 4).strokeColor(color).strokeOpacity(0.5).lineWidth(1).stroke();
  doc.fillColor(color).fillOpacity(1).fontSize(8).font('Helvetica-Bold')
     .text(label, bx, by + 9, { width: bw, align: 'center' });
  bx += bw + bGap;
}

// Description
doc.fillColor(C.textDim).fillOpacity(1).fontSize(10).font('Helvetica')
   .text(
     'このドキュメントは、Astro + Decap CMS + GitHub Pages で構築した\nインフラ・資格系技術ブログのアーキテクチャを解説します。\n各モジュールの役割と連携フローを図と表で説明します。',
     80, 290, { width: doc.page.width - 160, align: 'center', lineGap: 4 }
   );

// Mini architecture diagram on cover
const dY = 380;
// Browser
nodeBox(50, dY, 90, 40, C.surface, C.border, 'Browser', 'ユーザー');
arrowRight(140, dY + 20, 50);
// GitHub Pages
nodeBox(190, dY, 110, 40, C.surface, C.accent, 'GitHub Pages', 'ホスティング');
// Decap CMS arrow
doc.moveTo(245, dY).lineTo(245, dY - 35).lineTo(355, dY - 35).lineTo(355, dY)
   .strokeColor(C.accent2).strokeOpacity(0.6).lineWidth(1).dash(4, { space: 3 }).stroke();
doc.undash();
nodeBox(310, dY, 90, 40, C.surface, C.accent2, 'Decap CMS', '管理画面');
arrowRight(300, dY + 20, 50, C.accent2);
// GitHub
nodeBox(395, dY - 30, 90, 100, C.surface, C.border, 'GitHub\nRepo', 'git push');
arrowRight(485, dY + 20, 50);
// GitHub Actions
nodeBox(535, dY, 90, 40, C.surface, C.accent3, 'GitHub\nActions', 'CI/CD');
arrowDown(580, dY + 40, 40, C.accent3);
nodeBox(535, dY + 80, 90, 40, C.surface, C.accent, 'Astro Build\n+ Pagefind', 'dist/');

// Page table of contents
doc.fillColor(C.textMuted).fillOpacity(1).fontSize(9).font('Helvetica')
   .text('目次', 50, 510);
doc.moveTo(50, 522).lineTo(doc.page.width - 50, 522)
   .strokeColor(C.border).strokeOpacity(1).lineWidth(0.5).stroke();

const toc = [
  ['1', 'アーキテクチャ全体図'],
  ['2', 'ビルド・デプロイパイプライン'],
  ['3', 'ファイル構成とモジュール詳細'],
  ['4', 'リクエスト処理フロー'],
  ['5', '技術スタックまとめ'],
];
let tocY = 530;
for (const [num, title] of toc) {
  doc.fillColor(C.accent).fontSize(9).font('Helvetica-Bold')
     .text(`P.${parseInt(num)+1}`, 50, tocY);
  doc.fillColor(C.textDim).font('Helvetica')
     .text(title, 85, tocY);
  tocY += 18;
}

// Footer
doc.fillColor(C.textMuted).fontSize(8).font('Helvetica')
   .text('Generated by Claude Code  |  2026-02-25', 0, doc.page.height - 30, { align: 'center' });

// ─────────────────────────────────────────────
// PAGE 2: 全体アーキテクチャ図
// ─────────────────────────────────────────────
doc.addPage();
pageBg();
doc.rect(0, 0, doc.page.width, 4).fillColor(C.accent).fillOpacity(1).fill();

doc.fillColor(C.textMuted).fontSize(9).font('Helvetica').text('// P.2', 50, 18);
doc.fillColor(C.text).fontSize(20).font('Helvetica-Bold').text('アーキテクチャ全体図', 50, 35);
doc.moveTo(50, 62).lineTo(300, 62).strokeColor(C.border).lineWidth(0.5).stroke();
doc.moveTo(50, 62).lineTo(130, 62).strokeColor(C.accent).lineWidth(2).stroke();

// Three zones
const W = doc.page.width - 100;

// Zone: User
sectionBox(50, 80, W, 80, C.accent, 'USER ZONE');
nodeBox(70, 100, 100, 44, C.surface, C.accent, 'ブラウザ', 'HTTPS');
doc.fillColor(C.textDim).fontSize(8).font('Helvetica')
   .text('記事閲覧 / 検索', 185, 108)
   .text('GitHub Pages へアクセス', 185, 120)
   .text('管理者: Decap CMS で執筆', 185, 132);

// Zone: GitHub
sectionBox(50, 180, W, 120, C.accent2, 'GITHUB ZONE');
// Repo
nodeBox(70, 205, 110, 50, C.surface, C.accent2, 'GitHub Repository', 'Private / main branch');
// Actions
nodeBox(210, 205, 120, 50, C.surface, C.accent3, 'GitHub Actions', 'CI/CD Pipeline');
// Pages
nodeBox(360, 205, 110, 50, C.surface, C.accent, 'GitHub Pages', 'CDN Hosting');
// Decap CMS
nodeBox(500, 205, 100, 50, C.surface, C.green, 'Decap CMS', '/admin OAuth');
// arrows
arrowRight(180, 230, 30, C.accent2);
arrowRight(330, 230, 30, C.accent3);
arrowRight(470, 230, 30, C.accent);
// Decap → Repo
doc.moveTo(550, 205).lineTo(550, 190).lineTo(125, 190).lineTo(125, 205)
   .strokeColor(C.green).strokeOpacity(0.6).lineWidth(1).dash(4, {space:3}).stroke();
doc.undash();
doc.fillColor(C.green).fontSize(7).text('git push (OAuth)', 230, 185);

// Zone: Build
sectionBox(50, 320, W, 180, C.accent3, 'BUILD ZONE  (GitHub Actions)');
const bNodes = [
  { x: 60,  label: 'npm ci',        sub: '依存関係インストール', c: C.surface, s: C.textMuted },
  { x: 155, label: 'astro build',   sub: 'HTML/CSS/JS生成', c: C.surface, s: C.accent },
  { x: 255, label: 'expressive-code', sub: 'コードハイライト', c: C.surface, s: C.accent2 },
  { x: 355, label: 'pagefind',      sub: '検索インデックス生成', c: C.surface, s: C.accent3 },
  { x: 455, label: 'upload-artifact', sub: 'dist/ → Pages', c: C.surface, s: C.green },
];
for (let i = 0; i < bNodes.length; i++) {
  const n = bNodes[i];
  nodeBox(n.x, 345, 90, 50, n.c, n.s, n.label, n.sub);
  if (i < bNodes.length - 1) arrowRight(n.x + 90, 370, 15, C.textDim);
}

// Astro plugins sub-nodes
sectionBox(155, 405, 290, 60, C.accent, '');
doc.fillColor(C.accent).fontSize(7).text('Astro Integrations', 160, 410);
const plugins = [
  { x: 165, label: 'MDX', c: C.accent },
  { x: 225, label: 'Sitemap', c: C.accent2 },
  { x: 300, label: 'RSS', c: C.accent3 },
  { x: 370, label: 'Tailwind\nCSS v4', c: C.green },
];
for (const p of plugins) {
  doc.roundedRect(p.x, 420, 55, 34, 4).fillColor(p.c).fillOpacity(0.15).fill();
  doc.roundedRect(p.x, 420, 55, 34, 4).strokeColor(p.c).strokeOpacity(0.5).lineWidth(1).stroke();
  doc.fillColor(p.c).fillOpacity(1).fontSize(7).font('Helvetica-Bold')
     .text(p.label, p.x, 430, { width: 55, align: 'center' });
}

// User → Pages arrow
arrowDown(105, 160, 20, C.accent);
doc.fillColor(C.textDim).fontSize(7).text('HTTPS', 112, 163);

// Pages → User arrow
doc.moveTo(80, 180).lineTo(80, 165).lineTo(155, 165).lineTo(155, 160)
   .strokeColor(C.accent).strokeOpacity(0.5).lineWidth(1).dash(3,{space:3}).stroke();
doc.undash();

// Actions → Build arrow
arrowDown(270, 255, 65, C.accent3);
doc.fillColor(C.textDim).fontSize(7).text('trigger', 275, 270);

// Footer
doc.fillColor(C.textMuted).fontSize(8).font('Helvetica')
   .text('Generated by Claude Code  |  2026-02-25', 0, doc.page.height - 30, { align: 'center' });

// ─────────────────────────────────────────────
// PAGE 3: ビルド・デプロイパイプライン
// ─────────────────────────────────────────────
doc.addPage();
pageBg();
doc.rect(0, 0, doc.page.width, 4).fillColor(C.accent).fillOpacity(1).fill();

doc.fillColor(C.textMuted).fontSize(9).font('Helvetica').text('// P.3', 50, 18);
doc.fillColor(C.text).fontSize(20).font('Helvetica-Bold').text('ビルド・デプロイパイプライン', 50, 35);
doc.moveTo(50, 62).lineTo(300, 62).strokeColor(C.border).lineWidth(0.5).stroke();
doc.moveTo(50, 62).lineTo(130, 62).strokeColor(C.accent).lineWidth(2).stroke();

// Pipeline steps (vertical flow)
const steps = [
  {
    num: '1', color: C.accent2, title: 'Trigger',
    desc: 'main ブランチへの git push または手動実行 (workflow_dispatch)\nブランチ保護ルールにより、オーナーのみ push 可能',
    tag: '.github/workflows/deploy.yml',
  },
  {
    num: '2', color: C.accent, title: 'Checkout & Setup',
    desc: 'actions/checkout@v4 でソースコードを取得\nactions/setup-node@v4 で Node.js 20 をセットアップ\nnpm ci で package-lock.json を使った厳密なインストール',
    tag: 'ubuntu-latest runner',
  },
  {
    num: '3', color: C.accent3, title: 'astro build',
    desc: 'Astroが全ページをHTMLに静的レンダリング\nastro-expressive-code でコードブロックをシンタックスハイライト\n@astrojs/mdx でMDXをHTMLに変換\n@tailwindcss/vite でCSSをpurge&minify\n成果物は dist/ ディレクトリに出力',
    tag: 'npm run build',
  },
  {
    num: '4', color: C.green, title: 'Pagefind インデックス生成',
    desc: 'dist/ の全HTMLを解析して全文検索インデックスを生成\n日本語テキストも対応 (WebAssembly tokenizer)\ndist/pagefind/ にWASM+インデックスファイルを配置',
    tag: 'npx pagefind --site dist',
  },
  {
    num: '5', color: C.accent, title: 'Deploy to GitHub Pages',
    desc: 'upload-pages-artifact@v3 で dist/ をアーティファクトとしてアップロード\ndeploy-pages@v4 でGitHub Pages CDNに配信\nOIDCトークンで認証 (シークレット不要)',
    tag: 'github-pages environment',
  },
];

let sy = 80;
for (const step of steps) {
  const h = 75;
  // Number circle
  doc.circle(75, sy + h / 2, 16).fillColor(step.color).fillOpacity(0.9).fill();
  doc.fillColor(C.bg).fillOpacity(1).fontSize(12).font('Helvetica-Bold')
     .text(step.num, 69, sy + h / 2 - 7, { width: 12, align: 'center' });
  // Box
  sectionBox(100, sy, W - 50, h, step.color, '');
  doc.fillColor(step.color).fontSize(11).font('Helvetica-Bold')
     .text(step.title, 115, sy + 8);
  doc.fillColor(step.tag ? C.accent3 : C.textDim).fontSize(7).font('Helvetica')
     .text(`[ ${step.tag} ]`, 115, sy + 22);
  doc.fillColor(C.textDim).fontSize(8).font('Helvetica')
     .text(step.desc, 115, sy + 33, { width: W - 80, lineGap: 2 });
  // connector
  if (step !== steps[steps.length - 1]) {
    arrowDown(75, sy + h, 12, step.color);
  }
  sy += h + 12;
}

// Footer
doc.fillColor(C.textMuted).fontSize(8).font('Helvetica')
   .text('Generated by Claude Code  |  2026-02-25', 0, doc.page.height - 30, { align: 'center' });

// ─────────────────────────────────────────────
// PAGE 4: ファイル構成とモジュール詳細
// ─────────────────────────────────────────────
doc.addPage();
pageBg();
doc.rect(0, 0, doc.page.width, 4).fillColor(C.accent).fillOpacity(1).fill();

doc.fillColor(C.textMuted).fontSize(9).font('Helvetica').text('// P.4', 50, 18);
doc.fillColor(C.text).fontSize(20).font('Helvetica-Bold').text('ファイル構成とモジュール詳細', 50, 35);
doc.moveTo(50, 62).lineTo(300, 62).strokeColor(C.border).lineWidth(0.5).stroke();
doc.moveTo(50, 62).lineTo(130, 62).strokeColor(C.accent).lineWidth(2).stroke();

// Left column: file tree
const colW = 220;
sectionBox(50, 75, colW, 680, C.border, 'ファイル構成');

const tree = [
  ['/', C.textMuted, 0],
  ['├─ src/', C.accent, 0],
  ['│  ├─ content/', C.accent2, 1],
  ['│  │  └─ posts/*.md', C.textDim, 2],
  ['│  ├─ components/', C.accent3, 1],
  ['│  │  ├─ Header.astro', C.textDim, 2],
  ['│  │  ├─ Footer.astro', C.textDim, 2],
  ['│  │  ├─ PostCard.astro', C.textDim, 2],
  ['│  │  ├─ TagBadge.astro', C.textDim, 2],
  ['│  │  └─ TableOfContents.astro', C.textDim, 2],
  ['│  ├─ layouts/', C.green, 1],
  ['│  │  ├─ Base.astro', C.textDim, 2],
  ['│  │  └─ Post.astro', C.textDim, 2],
  ['│  ├─ pages/', C.accent, 1],
  ['│  │  ├─ index.astro', C.textDim, 2],
  ['│  │  ├─ about.astro', C.textDim, 2],
  ['│  │  ├─ search.astro', C.textDim, 2],
  ['│  │  ├─ posts/[...slug].astro', C.textDim, 2],
  ['│  │  ├─ tags/index.astro', C.textDim, 2],
  ['│  │  └─ tags/[tag].astro', C.textDim, 2],
  ['│  └─ styles/global.css', C.accent2, 1],
  ['├─ public/', C.accent3, 0],
  ['│  └─ admin/', C.textDim, 1],
  ['│     ├─ index.html', C.textDim, 2],
  ['│     └─ config.yml', C.textDim, 2],
  ['├─ .github/', C.green, 0],
  ['│  └─ workflows/', C.textDim, 1],
  ['│     └─ deploy.yml', C.textDim, 2],
  ['├─ astro.config.mjs', C.accent, 0],
  ['├─ content.config.ts', C.accent2, 0],
  ['└─ package.json', C.textDim, 0],
];

let ty = 92;
for (const [label, color] of tree) {
  doc.fillColor(color).fillOpacity(1).fontSize(7).font('Courier')
     .text(label, 60, ty, { lineGap: 0 });
  ty += 12;
}

// Right column: module descriptions
const rx = 290;
const rw = doc.page.width - rx - 50;

const modules = [
  {
    title: 'content.config.ts', color: C.accent2,
    role: 'コンテンツスキーマ定義',
    desc: 'Zodスキーマで記事フロントマターを厳密にバリデート。タイトル・説明文の文字数制限、カテゴリの列挙型チェック、URLバリデーションを含む。',
  },
  {
    title: 'astro.config.mjs', color: C.accent,
    role: 'Astro設定ファイル',
    desc: 'expressive-code、MDX、Sitemapプラグインを統合。Tailwind CSSはViteプラグインとして組み込み。生HTMLの埋め込みを無効化しセキュリティを向上。',
  },
  {
    title: 'layouts/Base.astro', color: C.green,
    role: '共通レイアウト',
    desc: 'SEOメタタグ・OGP・CSPメタタグを一元管理。Header/Footerを含み全ページに適用される。X-Frame-Options、Content-Type-Optionsも設定。',
  },
  {
    title: 'layouts/Post.astro', color: C.green,
    role: '記事専用レイアウト',
    desc: '2カラムグリッド（本文70% + サイドバー30%）。TableOfContentsで目次を自動生成。IntersectionObserverで現在読んでいる見出しをハイライト。',
  },
  {
    title: 'pages/index.astro', color: C.accent,
    role: 'トップページ',
    desc: 'featured:trueの記事をヒーロー表示。全記事を新着順で3カラムグリッドに表示。PostCardコンポーネントを再利用。',
  },
  {
    title: 'pages/posts/[...slug].astro', color: C.accent,
    role: '記事詳細ページ',
    desc: 'getStaticPaths()でビルド時に全記事のパスを生成。Astro Content CollectionsのrenderEntry()でMarkdownをHTMLに変換。',
  },
  {
    title: 'global.css', color: C.accent2,
    role: 'グローバルスタイル',
    desc: 'CSS変数でデザイントークンを管理（--accent, --bgなど）。Bebas Neue/Space Mono/Noto Sans JPをGoogle Fontsから読み込み。proseクラスで記事本文スタイルを定義。',
  },
];

let my = 78;
for (const m of modules) {
  const mh = 72;
  sectionBox(rx, my, rw, mh, m.color, '');
  doc.fillColor(m.color).fillOpacity(1).fontSize(8.5).font('Courier')
     .text(m.title, rx + 8, my + 7);
  doc.fillColor(C.textMuted).fontSize(7).font('Helvetica')
     .text(`役割: ${m.role}`, rx + 8, my + 20);
  doc.fillColor(C.textDim).fontSize(7.5).font('Helvetica')
     .text(m.desc, rx + 8, my + 32, { width: rw - 16, lineGap: 2 });
  my += mh + 8;
}

// Footer
doc.fillColor(C.textMuted).fontSize(8).font('Helvetica')
   .text('Generated by Claude Code  |  2026-02-25', 0, doc.page.height - 30, { align: 'center' });

// ─────────────────────────────────────────────
// PAGE 5: リクエスト処理フロー
// ─────────────────────────────────────────────
doc.addPage();
pageBg();
doc.rect(0, 0, doc.page.width, 4).fillColor(C.accent).fillOpacity(1).fill();

doc.fillColor(C.textMuted).fontSize(9).font('Helvetica').text('// P.5', 50, 18);
doc.fillColor(C.text).fontSize(20).font('Helvetica-Bold').text('リクエスト処理フロー', 50, 35);
doc.moveTo(50, 62).lineTo(300, 62).strokeColor(C.border).lineWidth(0.5).stroke();
doc.moveTo(50, 62).lineTo(130, 62).strokeColor(C.accent).lineWidth(2).stroke();

// Sequence diagram style
const actors = [
  { name: 'Browser', x: 80,  color: C.accent },
  { name: 'GitHub\nPages CDN', x: 200, color: C.accent },
  { name: 'Pagefind\n(WASM)', x: 330, color: C.accent3 },
  { name: 'Decap\nCMS', x: 460, color: C.green },
  { name: 'GitHub\nAPI', x: 575, color: C.accent2 },
];

const aY = 80;
// Actor boxes
for (const a of actors) {
  nodeBox(a.x - 40, aY, 80, 36, C.surface, a.color, a.name, '');
  // Lifeline
  doc.moveTo(a.x, aY + 36).lineTo(a.x, 620)
     .strokeColor(a.color).strokeOpacity(0.2).lineWidth(1).dash(4,{space:4}).stroke();
  doc.undash();
}

// Messages
const msgs = [
  { from: 0, to: 1, y: 140, label: 'GET /posts/article-slug', color: C.accent, note: 'HTTPSリクエスト' },
  { from: 1, to: 0, y: 165, label: 'HTML + CSS + JS (pre-built)', color: C.accent, note: '静的ファイルを返却', dashed: true },
  { from: 0, to: 2, y: 200, label: 'pagefind.js + WASM を読み込み', color: C.accent3, note: 'JS import (遅延)' },
  { from: 0, to: 2, y: 235, label: '検索クエリ送信 (ローカル)', color: C.accent3, note: 'HTTP通信不要' },
  { from: 2, to: 0, y: 260, label: '検索結果 (JSON)', color: C.accent3, note: 'インデックスから', dashed: true },
  { from: 0, to: 3, y: 300, label: 'GET /admin (管理者のみ)', color: C.green, note: 'OAuth認証' },
  { from: 3, to: 4, y: 325, label: 'GitHub OAuth token', color: C.green, note: '認証コード交換' },
  { from: 4, to: 3, y: 350, label: 'access_token', color: C.green, dashed: true },
  { from: 3, to: 4, y: 380, label: 'PUSH /repos/*/contents/* (記事保存)', color: C.accent2, note: 'GitHub API v3' },
  { from: 4, to: 3, y: 405, label: '201 Created', color: C.accent2, dashed: true },
  { from: 0, to: 1, y: 440, label: 'GET /rss.xml', color: C.accent3, note: 'RSSリーダー' },
  { from: 1, to: 0, y: 465, label: 'RSS XML', color: C.accent3, dashed: true },
];

for (const m of msgs) {
  const x1 = actors[m.from].x;
  const x2 = actors[m.to].x;
  const dir = x2 > x1 ? 1 : -1;
  const arrowX = x2 + (dir > 0 ? -8 : 8);
  // Line
  if (m.dashed) {
    doc.moveTo(x1, m.y).lineTo(arrowX, m.y)
       .strokeColor(m.color).strokeOpacity(0.6).lineWidth(1).dash(4,{space:3}).stroke();
    doc.undash();
  } else {
    doc.moveTo(x1, m.y).lineTo(arrowX, m.y)
       .strokeColor(m.color).strokeOpacity(0.8).lineWidth(1.5).stroke();
  }
  // Arrowhead
  doc.polygon(
    [arrowX, m.y - 4],
    [x2, m.y],
    [arrowX, m.y + 4]
  ).fillColor(m.color).fillOpacity(0.8).fill();
  // Label
  const lx = Math.min(x1, x2) + Math.abs(x2 - x1) / 2;
  doc.fillColor(m.color).fillOpacity(1).fontSize(6.5).font('Helvetica')
     .text(m.label, lx - 60, m.y - 10, { width: 120, align: 'center' });
  if (m.note) {
    doc.fillColor(C.textMuted).fontSize(6).font('Helvetica')
       .text(`(${m.note})`, lx - 60, m.y + 4, { width: 120, align: 'center' });
  }
}

// Legend
sectionBox(50, 630, W, 50, C.border, 'Legend');
const legends = [
  ['→', C.accent, '通常のHTTPリクエスト'],
  ['--→', C.accent3, 'ローカル処理 / レスポンス'],
  ['→', C.green, 'CMS / OAuth操作'],
  ['→', C.accent2, 'GitHub API'],
];
let lx = 65;
for (const [sym, color, label] of legends) {
  doc.fillColor(color).fontSize(8).font('Helvetica').text(sym, lx, 647);
  doc.fillColor(C.textDim).text(label, lx + 16, 647);
  lx += 120;
}

// Footer
doc.fillColor(C.textMuted).fontSize(8).font('Helvetica')
   .text('Generated by Claude Code  |  2026-02-25', 0, doc.page.height - 30, { align: 'center' });

// ─────────────────────────────────────────────
// PAGE 6: 技術スタックまとめ
// ─────────────────────────────────────────────
doc.addPage();
pageBg();
doc.rect(0, 0, doc.page.width, 4).fillColor(C.accent).fillOpacity(1).fill();

doc.fillColor(C.textMuted).fontSize(9).font('Helvetica').text('// P.6', 50, 18);
doc.fillColor(C.text).fontSize(20).font('Helvetica-Bold').text('技術スタックまとめ', 50, 35);
doc.moveTo(50, 62).lineTo(300, 62).strokeColor(C.border).lineWidth(0.5).stroke();
doc.moveTo(50, 62).lineTo(130, 62).strokeColor(C.accent).lineWidth(2).stroke();

// Table
const headers = ['レイヤー', '技術', 'バージョン', '役割'];
const colWidths = [95, 110, 70, W - 95 - 110 - 70];
const tableX = 50;
let tableY = 78;
const rowH = 28;

// Header row
let cx2 = tableX;
for (let i = 0; i < headers.length; i++) {
  doc.rect(cx2, tableY, colWidths[i], rowH).fillColor(C.surface).fillOpacity(1).fill();
  doc.rect(cx2, tableY, colWidths[i], rowH).strokeColor(C.border).strokeOpacity(1).lineWidth(0.5).stroke();
  doc.fillColor(C.accent).fontSize(8).font('Helvetica-Bold')
     .text(headers[i], cx2 + 6, tableY + 9, { width: colWidths[i] - 12 });
  cx2 += colWidths[i];
}
tableY += rowH;

const rows = [
  ['フレームワーク', 'Astro', 'v5.x', '静的サイト生成 / コンテンツコレクション / ファイルベースルーティング'],
  ['スタイリング', 'Tailwind CSS', 'v4.x', 'ユーティリティファーストCSS / ViteプラグインとしてゼロJS統合'],
  ['構文強調', 'astro-expressive-code', 'v0.41+', 'コードブロックのシンタックスハイライト (Dracula theme)'],
  ['検索', 'Pagefind', 'v1.x', 'ビルド後静的生成の全文検索 / WASM / HTTP通信不要'],
  ['CMS', 'Decap CMS', 'latest', 'GitHubをバックエンドとするヘッドレスCMS / OAuth認証'],
  ['ホスティング', 'GitHub Pages', '-', '静的ファイルのCDN配信 / カスタムドメイン対応'],
  ['CI/CD', 'GitHub Actions', '-', '自動ビルド & デプロイパイプライン / OIDC認証'],
  ['バリデーション', 'Zod', 'via Astro', 'コンテンツスキーマの型安全なバリデーション'],
  ['言語', 'TypeScript', 'strict', '型安全な開発 / Astroコンポーネントのフロントマター'],
  ['フォント', 'Bebas Neue / Space Mono / Noto Sans JP', 'Google', '日本語対応フォント + 欧文ディスプレイ / 等幅フォント'],
  ['セキュリティ', 'CSP / X-Frame-Options / Zod', '-', 'XSS/クリックジャッキング防止 / コンテンツバリデーション'],
];

for (let ri = 0; ri < rows.length; ri++) {
  const row = rows[ri];
  cx2 = tableX;
  for (let ci = 0; ci < row.length; ci++) {
    const bg = ri % 2 === 0 ? C.bg : C.bg2;
    doc.rect(cx2, tableY, colWidths[ci], rowH).fillColor(bg).fillOpacity(1).fill();
    doc.rect(cx2, tableY, colWidths[ci], rowH).strokeColor(C.border).strokeOpacity(1).lineWidth(0.5).stroke();
    const color = ci === 0 ? C.accent3 : ci === 1 ? C.accent : C.textDim;
    const bold = ci <= 1;
    doc.fillColor(color).fontSize(7.5).font(bold ? 'Helvetica-Bold' : 'Helvetica')
       .text(row[ci], cx2 + 6, tableY + 9, { width: colWidths[ci] - 12, lineGap: 0 });
    cx2 += colWidths[ci];
  }
  tableY += rowH;
}

// Security summary box
const secY = tableY + 20;
sectionBox(50, secY, W, 100, C.accent2, 'セキュリティ設計まとめ');

const secItems = [
  ['GitHub', 'リポジトリPrivate + Branch Protection Rules + Collaborator権限制御'],
  ['Decap CMS', 'GitHub OAuth必須 / Collaboratorでないユーザーは操作不可'],
  ['CSP', 'script-src / style-src / frame-src を厳密に制限 (XSS・iframe injection防止)'],
  ['Zod', 'コンテンツスキーマで不正なフロントマター値を型レベルで拒否'],
  ['Actions', '最小権限 (contents:read, pages:write, id-token:write のみ) / npm ci で依存固定'],
];

let siY = secY + 18;
for (const [key, val] of secItems) {
  doc.roundedRect(60, siY, 70, 14, 2).fillColor(C.accent2).fillOpacity(0.2).fill();
  doc.fillColor(C.accent2).fillOpacity(1).fontSize(7).font('Helvetica-Bold')
     .text(key, 60, siY + 3, { width: 70, align: 'center' });
  doc.fillColor(C.textDim).fontSize(7.5).font('Helvetica')
     .text(val, 138, siY + 3, { width: W - 98 });
  siY += 18;
}

// Final footer
doc.fillColor(C.textMuted).fontSize(8).font('Helvetica')
   .text('Generated by Claude Code  |  2026-02-25', 0, doc.page.height - 30, { align: 'center' });

// Done
doc.end();
console.log(`✅ PDF generated: ${outPath}`);
