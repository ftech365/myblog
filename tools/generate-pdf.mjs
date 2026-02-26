import puppeteer from 'puppeteer';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(__dirname, 'blog-architecture.html');
const pdfPath = join(__dirname, '../blog-architecture.pdf');

const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>技術ブログ構築ガイド — アーキテクチャ解説</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:      #080c14;
    --bg2:     #0d1220;
    --surface: #151d2e;
    --surface2:#1a2340;
    --border:  #1e2d47;
    --accent:  #00e5ff;
    --accent2: #7c3aed;
    --accent3: #f59e0b;
    --green:   #22c55e;
    --text:    #e2e8f0;
    --dim:     #94a3b8;
    --muted:   #64748b;
    --mono:    'Space Mono', monospace;
    --body:    'Noto Sans JP', sans-serif;
    --display: 'Bebas Neue', cursive;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--body);
    font-size: 13px;
    line-height: 1.7;
    width: 210mm;
  }

  /* ===================== COVER PAGE ===================== */
  .cover {
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 60px 40px;
    background: var(--bg);
    position: relative;
    overflow: hidden;
    page-break-after: always;
  }

  .cover::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px);
    background-size: 40px 40px;
    mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black, transparent);
  }

  .cover-glow {
    position: absolute;
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(0,229,255,0.06) 0%, transparent 70%);
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
  }

  .cover-inner { position: relative; z-index: 1; text-align: center; }

  .cover-tag {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--accent);
    letter-spacing: 4px;
    text-transform: uppercase;
    margin-bottom: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .cover-tag::before, .cover-tag::after {
    content: '';
    display: inline-block;
    width: 40px;
    height: 1px;
    background: var(--accent);
    opacity: 0.4;
  }

  .cover-title {
    font-family: var(--display);
    font-size: 80px;
    letter-spacing: 6px;
    line-height: 0.9;
    margin-bottom: 8px;
    color: var(--text);
  }
  .cover-title span {
    color: transparent;
    -webkit-text-stroke: 2px var(--accent);
  }

  .cover-subtitle {
    font-family: var(--display);
    font-size: 36px;
    letter-spacing: 4px;
    color: var(--dim);
    margin-bottom: 48px;
  }

  .cover-desc {
    font-size: 14px;
    color: var(--dim);
    line-height: 1.8;
    max-width: 480px;
    margin: 0 auto 60px;
  }

  .cover-stack {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: center;
    margin-bottom: 80px;
  }

  .stack-badge {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 1px;
    padding: 6px 14px;
    border-radius: 100px;
    border: 1px solid var(--border);
    color: var(--muted);
  }
  .stack-badge.highlight {
    border-color: var(--accent);
    color: var(--accent);
    background: rgba(0,229,255,0.08);
  }

  .cover-footer {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 2px;
    border-top: 1px solid var(--border);
    padding-top: 24px;
    width: 100%;
    text-align: center;
  }

  /* ===================== PAGES ===================== */
  .page {
    min-height: 297mm;
    padding: 50px 48px;
    background: var(--bg);
    position: relative;
    page-break-after: always;
  }

  .page-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border);
  }

  .page-title {
    font-family: var(--display);
    font-size: 32px;
    letter-spacing: 3px;
    color: var(--text);
  }
  .page-title span { color: var(--accent); }

  .step-badge {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 2px;
    color: var(--accent);
    border: 1px solid rgba(0,229,255,0.3);
    padding: 6px 14px;
    border-radius: 4px;
    background: rgba(0,229,255,0.05);
  }

  /* Section label */
  .section-label {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .section-label::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--border);
  }

  /* Diagram boxes */
  .diagram {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 24px;
    margin-bottom: 20px;
    position: relative;
  }
  .diagram::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0,229,255,0.02) 0%, transparent 50%);
    border-radius: 10px;
    pointer-events: none;
  }

  /* Flow diagram */
  .flow {
    display: flex;
    align-items: stretch;
    gap: 0;
    flex-wrap: wrap;
  }

  .flow-item {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px 16px;
    flex: 1;
    min-width: 100px;
    position: relative;
    text-align: center;
  }

  .flow-item-label {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 6px;
  }

  .flow-item-text {
    font-size: 12px;
    color: var(--text);
    font-weight: 500;
    line-height: 1.4;
  }

  .flow-item-sub {
    font-size: 10px;
    color: var(--muted);
    margin-top: 4px;
  }

  .flow-arrow {
    display: flex;
    align-items: center;
    padding: 0 8px;
    color: var(--accent);
    font-size: 18px;
    flex-shrink: 0;
  }

  /* Vertical flow */
  .vflow { display: flex; flex-direction: column; gap: 4px; }

  .vflow-item {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .vflow-item.accent { border-color: rgba(0,229,255,0.4); background: rgba(0,229,255,0.04); }
  .vflow-item.violet { border-color: rgba(124,58,237,0.4); background: rgba(124,58,237,0.04); }
  .vflow-item.amber  { border-color: rgba(245,158,11,0.4);  background: rgba(245,158,11,0.04); }
  .vflow-item.green  { border-color: rgba(34,197,94,0.4);   background: rgba(34,197,94,0.04); }

  .vflow-icon {
    width: 28px; height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    flex-shrink: 0;
  }
  .vflow-icon.cyan   { background: rgba(0,229,255,0.15); }
  .vflow-icon.violet { background: rgba(124,58,237,0.15); }
  .vflow-icon.amber  { background: rgba(245,158,11,0.15); }
  .vflow-icon.green  { background: rgba(34,197,94,0.15); }

  .vflow-content {}
  .vflow-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.3;
  }
  .vflow-desc {
    font-size: 11px;
    color: var(--dim);
    line-height: 1.4;
  }

  .vflow-arrow {
    text-align: center;
    color: var(--muted);
    font-size: 14px;
    padding: 2px 0;
  }

  /* Grid layout */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }

  /* Module card */
  .module-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
  }
  .module-card-title {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    margin-bottom: 6px;
    letter-spacing: 0.5px;
  }
  .module-card-role {
    font-size: 12px;
    color: var(--dim);
    line-height: 1.6;
  }
  .module-card.violet .module-card-title { color: #a78bfa; }
  .module-card.amber  .module-card-title { color: var(--accent3); }
  .module-card.green  .module-card-title { color: #4ade80; }

  /* Table */
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
  th {
    background: var(--surface2);
    border: 1px solid var(--border);
    padding: 8px 12px;
    text-align: left;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    color: var(--accent);
  }
  td {
    border: 1px solid var(--border);
    padding: 8px 12px;
    color: var(--dim);
    line-height: 1.5;
  }
  tr:hover td { background: rgba(255,255,255,0.02); }

  /* Code block */
  .code {
    background: #080f1a;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
    margin: 12px 0;
    font-size: 11px;
  }
  .code-header {
    background: var(--surface);
    padding: 6px 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }
  .code-lang { font-family: var(--mono); font-size: 9px; color: var(--accent); letter-spacing: 1px; }
  .code-dots { display: flex; gap: 5px; }
  .code-dot { width: 8px; height: 8px; border-radius: 50%; }
  .code-body { padding: 14px 16px; }
  .code-body pre { font-family: var(--mono); font-size: 10px; line-height: 1.7; color: #c9d1d9; }
  .kw { color: #ff79c6; }
  .str { color: #f1fa8c; }
  .fn  { color: #50fa7b; }
  .cm  { color: #6272a4; }
  .num { color: var(--accent); }
  .key { color: #8be9fd; }

  /* Architecture diagram (SVG-based) */
  .arch-diagram {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px;
    margin-bottom: 16px;
  }

  /* Label pills */
  .pill {
    display: inline-block;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 1px;
    padding: 3px 8px;
    border-radius: 3px;
    margin: 2px 3px 2px 0;
  }
  .pill-cyan   { background: rgba(0,229,255,0.12);  color: var(--accent);  border: 1px solid rgba(0,229,255,0.25); }
  .pill-violet { background: rgba(124,58,237,0.12); color: #a78bfa;        border: 1px solid rgba(124,58,237,0.25); }
  .pill-amber  { background: rgba(245,158,11,0.12); color: var(--accent3); border: 1px solid rgba(245,158,11,0.25); }
  .pill-green  { background: rgba(34,197,94,0.12);  color: #4ade80;        border: 1px solid rgba(34,197,94,0.25); }

  /* Callout */
  .callout {
    border-left: 3px solid var(--accent);
    background: rgba(0,229,255,0.04);
    padding: 12px 16px;
    border-radius: 0 8px 8px 0;
    margin: 12px 0;
    font-size: 12px;
    color: var(--dim);
    line-height: 1.7;
  }
  .callout-title {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 2px;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 6px;
  }

  /* Text styles */
  h3 {
    font-size: 14px;
    font-weight: 700;
    color: var(--text);
    margin: 20px 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  h3::before {
    content: '#';
    color: var(--accent);
    font-family: var(--mono);
    font-size: 12px;
  }

  p { font-size: 12px; color: var(--dim); line-height: 1.8; margin-bottom: 10px; }

  /* Page number */
  .page-num {
    position: absolute;
    bottom: 24px;
    right: 48px;
    font-family: var(--mono);
    font-size: 9px;
    color: var(--muted);
    letter-spacing: 2px;
  }

  /* Connector lines */
  .connector {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin: 4px 0;
    color: var(--muted);
    font-size: 16px;
    line-height: 1;
  }

  /* TOC */
  .toc-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .toc-step {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--accent);
    width: 50px;
    flex-shrink: 0;
  }
  .toc-title { font-size: 13px; color: var(--text); flex: 1; }
  .toc-dots { flex: 1; border-bottom: 1px dashed var(--border); }
  .toc-page { font-family: var(--mono); font-size: 10px; color: var(--muted); }

  /* Dep graph */
  .dep-center {
    background: rgba(0,229,255,0.08);
    border: 2px solid var(--accent);
    border-radius: 8px;
    padding: 10px 16px;
    text-align: center;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--accent);
    font-weight: 700;
  }
  .dep-row {
    display: flex;
    gap: 8px;
    margin-top: 8px;
    justify-content: center;
  }
  .dep-node {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px;
    font-family: var(--mono);
    font-size: 10px;
    color: var(--dim);
    text-align: center;
    flex: 1;
  }
  .dep-node.cyan   { border-color: rgba(0,229,255,0.3);  color: var(--accent); }
  .dep-node.violet { border-color: rgba(124,58,237,0.3); color: #a78bfa; }
  .dep-node.amber  { border-color: rgba(245,158,11,0.3); color: var(--accent3); }
  .dep-node.green  { border-color: rgba(34,197,94,0.3);  color: #4ade80; }
</style>
</head>
<body>

<!-- =============================================================== -->
<!--  COVER PAGE                                                      -->
<!-- =============================================================== -->
<div class="cover">
  <div class="cover-glow"></div>
  <div class="cover-inner">
    <div class="cover-tag">Architecture Guide</div>

    <div class="cover-title">BUILD<br><span>INFRA</span><br>BLOG.</div>
    <div class="cover-subtitle">技術ブログ構築ガイド</div>

    <p class="cover-desc">
      Astro + Tailwind CSS + Decap CMS + GitHub Pages を使った
      インフラ・資格系技術ブログの構築ステップ、導入モジュールの役割、
      モジュール間の相関を図解で解説する。
    </p>

    <div class="cover-stack">
      <span class="stack-badge highlight">Astro v5</span>
      <span class="stack-badge highlight">Tailwind CSS v4</span>
      <span class="stack-badge">Expressive Code</span>
      <span class="stack-badge">Pagefind</span>
      <span class="stack-badge">Decap CMS</span>
      <span class="stack-badge highlight">GitHub Pages</span>
      <span class="stack-badge">GitHub Actions</span>
      <span class="stack-badge">TypeScript</span>
      <span class="stack-badge">Zod</span>
    </div>

    <div class="cover-footer">
      DEVLOG — INFRA &amp; CERTIFICATION TECH BLOG &nbsp;|&nbsp; 2025
    </div>
  </div>
</div>

<!-- =============================================================== -->
<!--  PAGE 1 — 全体アーキテクチャ                                      -->
<!-- =============================================================== -->
<div class="page">
  <div class="page-header">
    <div class="page-title">全体<span>アーキテクチャ</span></div>
    <div class="step-badge">OVERVIEW</div>
  </div>

  <div class="section-label">DEPLOYMENT PIPELINE</div>

  <div class="diagram">
    <div class="flow" style="margin-bottom:16px;">
      <div class="flow-item">
        <div class="flow-item-label">執筆</div>
        <div class="flow-item-text">Claude Code CLI<br>or Decap CMS</div>
        <div class="flow-item-sub">記事を.mdで保存</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-item">
        <div class="flow-item-label">バージョン管理</div>
        <div class="flow-item-text">GitHub<br>Repository</div>
        <div class="flow-item-sub">git push to main</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-item">
        <div class="flow-item-label">CI/CD</div>
        <div class="flow-item-text">GitHub<br>Actions</div>
        <div class="flow-item-sub">自動ビルド&デプロイ</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-item">
        <div class="flow-item-label">ホスティング</div>
        <div class="flow-item-text">GitHub<br>Pages</div>
        <div class="flow-item-sub">静的HTMLを配信</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-item" style="border-color: rgba(0,229,255,0.4); background: rgba(0,229,255,0.04);">
        <div class="flow-item-label">訪問者</div>
        <div class="flow-item-text">Browser</div>
        <div class="flow-item-sub">記事を閲覧</div>
      </div>
    </div>
  </div>

  <div class="section-label">BUILD PROCESS（astro build の中で起きること）</div>

  <div class="diagram">
    <div class="grid-2">
      <div>
        <div class="vflow">
          <div class="vflow-item accent">
            <div class="vflow-icon cyan">📄</div>
            <div class="vflow-content">
              <div class="vflow-title">src/content/posts/*.md</div>
              <div class="vflow-desc">Markdownで書かれた記事ファイル群</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item">
            <div class="vflow-icon violet">🔍</div>
            <div class="vflow-content">
              <div class="vflow-title">content.config.ts（Zod）</div>
              <div class="vflow-desc">フロントマターをバリデーション・型変換</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item">
            <div class="vflow-icon cyan">⚡</div>
            <div class="vflow-content">
              <div class="vflow-title">pages/posts/[...slug].astro</div>
              <div class="vflow-desc">全記事分のHTMLを静的生成</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item amber">
            <div class="vflow-icon amber">📦</div>
            <div class="vflow-content">
              <div class="vflow-title">dist/ （ビルド成果物）</div>
              <div class="vflow-desc">HTML / CSS / JS が出力される</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="vflow">
          <div class="vflow-item">
            <div class="vflow-icon cyan">🎨</div>
            <div class="vflow-content">
              <div class="vflow-title">Tailwind CSS v4</div>
              <div class="vflow-desc">使われているクラスのみ抽出してCSSを最小化</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item">
            <div class="vflow-icon green">💻</div>
            <div class="vflow-content">
              <div class="vflow-title">Expressive Code</div>
              <div class="vflow-desc">コードブロックをビルド時にHTMLへ変換（Dracula テーマ）</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item">
            <div class="vflow-icon violet">🗺</div>
            <div class="vflow-content">
              <div class="vflow-title">@astrojs/sitemap</div>
              <div class="vflow-desc">全ページURLのsitemap-index.xmlを自動生成</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item accent">
            <div class="vflow-icon cyan">🔎</div>
            <div class="vflow-content">
              <div class="vflow-title">Pagefind（ビルド後実行）</div>
              <div class="vflow-desc">dist/HTMLを全件解析して検索インデックスを生成</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section-label">CONTENTS OF dist/ （GitHub Pagesに公開されるファイル）</div>
  <div class="diagram">
    <div class="grid-3">
      <div class="module-card">
        <div class="module-card-title">index.html</div>
        <div class="module-card-role">TOPページ。記事一覧・フィーチャード記事</div>
      </div>
      <div class="module-card">
        <div class="module-card-title">posts/[slug]/index.html</div>
        <div class="module-card-role">各記事の詳細ページ（全記事分）</div>
      </div>
      <div class="module-card">
        <div class="module-card-title">tags/[tag]/index.html</div>
        <div class="module-card-role">タグ別記事一覧（全タグ分）</div>
      </div>
      <div class="module-card green">
        <div class="module-card-title">pagefind/</div>
        <div class="module-card-role">全文検索インデックス（WASM）</div>
      </div>
      <div class="module-card violet">
        <div class="module-card-title">sitemap-index.xml</div>
        <div class="module-card-role">SEO用サイトマップ</div>
      </div>
      <div class="module-card amber">
        <div class="module-card-title">rss.xml</div>
        <div class="module-card-role">RSSフィード（記事購読用）</div>
      </div>
    </div>
  </div>

  <div class="page-num">1 / 6</div>
</div>

<!-- =============================================================== -->
<!--  PAGE 2 — モジュール一覧と役割                                    -->
<!-- =============================================================== -->
<div class="page">
  <div class="page-header">
    <div class="page-title">モジュール<span>一覧</span></div>
    <div class="step-badge">MODULES</div>
  </div>

  <div class="section-label">コアフレームワーク</div>
  <div class="grid-2" style="margin-bottom:16px;">
    <div class="diagram" style="margin-bottom:0;">
      <div style="display:flex;align-items:flex-start;gap:14px;">
        <div style="width:48px;height:48px;background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🚀</div>
        <div>
          <div style="font-family:var(--mono);font-size:13px;color:var(--accent);font-weight:700;margin-bottom:4px;">astro v5</div>
          <div style="font-size:11px;color:var(--dim);line-height:1.7;">
            静的サイトジェネレーター。<code style="font-family:var(--mono);color:var(--accent);font-size:10px;background:rgba(0,229,255,0.08);padding:1px 4px;border-radius:3px;">.astro</code> ファイルをHTMLに変換。ビルド時に全ページを静的生成するため、サーバー不要で高速。Viteをビルドツールとして内部利用。
          </div>
        </div>
      </div>
    </div>
    <div class="diagram" style="margin-bottom:0;">
      <div style="display:flex;align-items:flex-start;gap:14px;">
        <div style="width:48px;height:48px;background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🔷</div>
        <div>
          <div style="font-family:var(--mono);font-size:13px;color:#a78bfa;font-weight:700;margin-bottom:4px;">TypeScript + Zod</div>
          <div style="font-size:11px;color:var(--dim);line-height:1.7;">
            TypeScriptで型安全な開発。Zodはコンテンツコレクションのスキーマバリデーションに使用。記事のフロントマターの型チェック・不正値の検出をビルド時に実施。
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section-label">スタイリング</div>
  <div class="diagram" style="margin-bottom:16px;">
    <div style="display:flex;align-items:flex-start;gap:14px;">
      <div style="width:48px;height:48px;background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🎨</div>
      <div style="flex:1;">
        <div style="font-family:var(--mono);font-size:13px;color:var(--accent);font-weight:700;margin-bottom:6px;">tailwindcss v4 + @tailwindcss/vite</div>
        <div style="font-size:11px;color:var(--dim);line-height:1.7;margin-bottom:10px;">
          ユーティリティファーストのCSSフレームワーク。<strong style="color:var(--text);">v4からは設定ファイル不要</strong>で、Viteプラグインとして直接統合。使用されたクラスのみ最終CSSに含まれるため出力ファイルが小さい。
        </div>
        <div style="display:flex;gap:8px;align-items:center;font-family:var(--mono);font-size:10px;">
          <span style="color:var(--muted);">global.css</span>
          <span style="color:var(--border);">→</span>
          <span style="color:var(--accent);">@import "tailwindcss"</span>
          <span style="color:var(--border);">→</span>
          <span style="color:var(--muted);">Viteが処理</span>
          <span style="color:var(--border);">→</span>
          <span style="color:var(--accent);">最適化CSS出力</span>
        </div>
      </div>
    </div>
  </div>

  <div class="section-label">コンテンツ処理 / 拡張機能</div>
  <div class="grid-2" style="margin-bottom:16px;">
    <div class="vflow">
      <div class="vflow-item accent">
        <div class="vflow-icon cyan">📝</div>
        <div class="vflow-content">
          <div class="vflow-title">@astrojs/mdx</div>
          <div class="vflow-desc">.mdxファイルでJSXコンポーネントをMarkdown内に埋め込み可能にする。通常の.mdに加えた拡張フォーマット。</div>
        </div>
      </div>
      <div class="vflow-item green">
        <div class="vflow-icon green">💻</div>
        <div class="vflow-content">
          <div class="vflow-title">astro-expressive-code</div>
          <div class="vflow-desc">コードブロックのシンタックスハイライト。ファイル名・コピーボタン・行番号・差分表示に対応。Dracula テーマを使用。</div>
        </div>
      </div>
    </div>
    <div class="vflow">
      <div class="vflow-item violet">
        <div class="vflow-icon violet">🗺</div>
        <div class="vflow-content">
          <div class="vflow-title">@astrojs/sitemap</div>
          <div class="vflow-desc">ビルド時に全ページのURLを収集してsitemap-index.xmlを自動生成。SEO向上に寄与。</div>
        </div>
      </div>
      <div class="vflow-item amber">
        <div class="vflow-icon amber">📡</div>
        <div class="vflow-content">
          <div class="vflow-title">@astrojs/rss</div>
          <div class="vflow-desc">/rss.xmlとしてRSSフィードを生成。記事更新をRSSリーダーで購読可能にする。</div>
        </div>
      </div>
    </div>
  </div>

  <div class="section-label">検索 / CMS</div>
  <div class="grid-2">
    <div class="diagram" style="margin-bottom:0;">
      <div style="font-family:var(--mono);font-size:12px;color:var(--accent);margin-bottom:8px;">🔎 pagefind</div>
      <div style="font-size:11px;color:var(--dim);line-height:1.7;">
        静的サイト向け全文検索。ビルド後に<code style="font-family:var(--mono);color:var(--accent);font-size:10px;background:rgba(0,229,255,0.08);padding:1px 4px;border-radius:3px;">npx pagefind --site dist</code>で検索インデックスを生成。WebAssemblyで動作するためサーバー不要。日本語にも対応。
      </div>
    </div>
    <div class="diagram" style="margin-bottom:0;">
      <div style="font-family:var(--mono);font-size:12px;color:#a78bfa;margin-bottom:8px;">⚙️ Decap CMS</div>
      <div style="font-size:11px;color:var(--dim);line-height:1.7;">
        GitHubをバックエンドにしたヘッドレスCMS。/adminにアクセスするとブラウザ上で記事を執筆でき、GitHubに自動コミット。OAuth認証で不正アクセスを防止。
      </div>
    </div>
  </div>

  <div class="page-num">2 / 6</div>
</div>

<!-- =============================================================== -->
<!--  PAGE 3 — Step 1〜3: 初期化・スキーマ                             -->
<!-- =============================================================== -->
<div class="page">
  <div class="page-header">
    <div class="page-title">Step <span>1〜3</span></div>
    <div class="step-badge">INIT / SCHEMA</div>
  </div>

  <div class="section-label">STEP 1 — プロジェクト初期化</div>
  <div class="diagram">
    <div class="code">
      <div class="code-header">
        <span class="code-lang">bash — 実行したコマンド</span>
        <div class="code-dots">
          <div class="code-dot" style="background:#ff5f56;"></div>
          <div class="code-dot" style="background:#ffbd2e;"></div>
          <div class="code-dot" style="background:#27c93f;"></div>
        </div>
      </div>
      <div class="code-body"><pre><span class="cm"># 1. Astro ブログテンプレートでプロジェクト作成</span>
npm create astro@latest . <span class="str">--template blog --typescript strict</span>

<span class="cm"># 2. Tailwind CSS を追加（設定ファイルも自動生成）</span>
npx astro add tailwind

<span class="cm"># 3. 追加パッケージをインストール</span>
npm install astro-expressive-code pagefind</pre></div>
    </div>
    <div class="grid-3" style="margin:14px 0 0;">
      <div class="module-card">
        <div class="module-card-title">astro.config.mjs</div>
        <div class="module-card-role">全インテグレーションの統合・設定の司令塔</div>
      </div>
      <div class="module-card violet">
        <div class="module-card-title">tsconfig.json</div>
        <div class="module-card-role">TypeScript strict modeを有効化</div>
      </div>
      <div class="module-card amber">
        <div class="module-card-title">package.json</div>
        <div class="module-card-role">依存パッケージとスクリプト管理</div>
      </div>
    </div>
  </div>

  <div class="section-label">STEP 2 — 依存パッケージ追加後の astro.config.mjs</div>
  <div class="code">
    <div class="code-header">
      <span class="code-lang">astro.config.mjs</span>
      <div class="code-dots">
        <div class="code-dot" style="background:#ff5f56;"></div>
        <div class="code-dot" style="background:#ffbd2e;"></div>
        <div class="code-dot" style="background:#27c93f;"></div>
      </div>
    </div>
    <div class="code-body"><pre><span class="kw">import</span> <span class="fn">expressiveCode</span> <span class="kw">from</span> <span class="str">'astro-expressive-code'</span>;  <span class="cm">// コードハイライト</span>
<span class="kw">import</span> <span class="fn">mdx</span>            <span class="kw">from</span> <span class="str">'@astrojs/mdx'</span>;            <span class="cm">// MDX形式対応</span>
<span class="kw">import</span> <span class="fn">sitemap</span>        <span class="kw">from</span> <span class="str">'@astrojs/sitemap'</span>;        <span class="cm">// SEOサイトマップ</span>
<span class="kw">import</span> <span class="fn">tailwindcss</span>    <span class="kw">from</span> <span class="str">'@tailwindcss/vite'</span>;      <span class="cm">// CSS処理</span>

<span class="kw">export default</span> <span class="fn">defineConfig</span>({
  site: <span class="str">'https://username.github.io'</span>,
  integrations: [<span class="fn">expressiveCode</span>(), <span class="fn">mdx</span>(), <span class="fn">sitemap</span>()],
  vite: { plugins: [<span class="fn">tailwindcss</span>()] },
});</pre></div>
  </div>

  <div class="section-label">STEP 3 — コンテンツスキーマ（Zodによる型安全）</div>
  <div class="diagram">
    <div style="display:flex;gap:16px;align-items:flex-start;">
      <div style="flex:1;">
        <div style="font-size:11px;color:var(--dim);margin-bottom:10px;line-height:1.7;">
          記事Markdownのフロントマターを<strong style="color:var(--text);">Zodスキーマ</strong>で型チェック。不正な値や型違いはビルド時にエラーとして検出される。
        </div>
        <div class="code" style="margin:0;">
          <div class="code-header">
            <span class="code-lang">src/content.config.ts</span>
            <div class="code-dots">
              <div class="code-dot" style="background:#ff5f56;"></div>
              <div class="code-dot" style="background:#ffbd2e;"></div>
              <div class="code-dot" style="background:#27c93f;"></div>
            </div>
          </div>
          <div class="code-body"><pre><span class="kw">const</span> posts = <span class="fn">defineCollection</span>({
  loader: <span class="fn">glob</span>({ base: <span class="str">'./src/content/posts'</span>,
                  pattern: <span class="str">'**/*.{md,mdx}'</span> }),
  schema: z.object({
    title:       z.string().<span class="fn">min</span>(<span class="num">1</span>).<span class="fn">max</span>(<span class="num">100</span>),
    description: z.string().<span class="fn">min</span>(<span class="num">1</span>).<span class="fn">max</span>(<span class="num">300</span>),
    pubDate:     z.coerce.date(),
    tags:        z.array(z.string()).<span class="fn">max</span>(<span class="num">10</span>).<span class="fn">default</span>([]),
    category:    z.<span class="fn">enum</span>([<span class="str">"AWS"</span>, <span class="str">"Linux"</span>, <span class="str">"Terraform"</span>, <span class="str">"..."</span>]),
    draft:       z.boolean().<span class="fn">default</span>(<span class="kw">false</span>),
    featured:    z.boolean().<span class="fn">default</span>(<span class="kw">false</span>),
  }),
});</pre></div>
        </div>
      </div>
      <div style="width:180px;flex-shrink:0;">
        <div style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:14px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--accent);margin-bottom:10px;letter-spacing:1.5px;">SCHEMA FLOW</div>
          <div class="vflow">
            <div style="background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.2);border-radius:6px;padding:8px 10px;font-size:10px;color:var(--dim);">
              記事.md<br><span style="color:var(--muted);font-size:9px;">---フロントマター---</span>
            </div>
            <div class="vflow-arrow">↓ glob() で読み込み</div>
            <div style="background:rgba(124,58,237,0.06);border:1px solid rgba(124,58,237,0.2);border-radius:6px;padding:8px 10px;font-size:10px;color:var(--dim);">
              Zodで検証<br><span style="color:var(--muted);font-size:9px;">型チェック・変換</span>
            </div>
            <div class="vflow-arrow">↓ 型付きデータ</div>
            <div style="background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:8px 10px;font-size:10px;color:var(--dim);">
              CollectionEntry<br><span style="color:var(--muted);font-size:9px;">各ページで利用可能</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="page-num">3 / 6</div>
</div>

<!-- =============================================================== -->
<!--  PAGE 4 — Step 4〜5: コンポーネント / ページ構造                  -->
<!-- =============================================================== -->
<div class="page">
  <div class="page-header">
    <div class="page-title">Step <span>4〜5</span></div>
    <div class="step-badge">DESIGN / PAGES</div>
  </div>

  <div class="section-label">STEP 4 — コンポーネント階層</div>
  <div class="diagram">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
      <!-- Base layout -->
      <div>
        <div style="font-family:var(--mono);font-size:10px;color:var(--accent);letter-spacing:1.5px;margin-bottom:10px;">BASE LAYOUT（全ページ共通）</div>
        <div style="background:var(--bg2);border:1px solid rgba(0,229,255,0.3);border-radius:8px;padding:12px;">
          <div style="font-family:var(--mono);font-size:11px;color:var(--accent);margin-bottom:10px;">Base.astro</div>
          <div style="padding-left:14px;border-left:1px dashed var(--border);">
            <div class="vflow">
              <div style="background:var(--surface2);border-radius:5px;padding:8px 10px;font-size:10px;color:var(--dim);">
                <span style="color:var(--accent);">BaseHead.astro</span><br>
                &lt;head&gt;, OGP, CSP, global.css
              </div>
              <div class="vflow-arrow" style="font-size:10px;">↓</div>
              <div style="background:var(--surface2);border-radius:5px;padding:8px 10px;font-size:10px;color:var(--dim);">
                <span style="color:var(--accent);">Header.astro</span><br>
                ロゴ / ナビ / 検索ボタン
              </div>
              <div class="vflow-arrow" style="font-size:10px;">↓</div>
              <div style="background:rgba(0,229,255,0.08);border:1px dashed rgba(0,229,255,0.3);border-radius:5px;padding:8px 10px;font-size:10px;color:var(--accent);">
                &lt;slot /&gt; ← 各ページの中身
              </div>
              <div class="vflow-arrow" style="font-size:10px;">↓</div>
              <div style="background:var(--surface2);border-radius:5px;padding:8px 10px;font-size:10px;color:var(--dim);">
                <span style="color:var(--accent);">Footer.astro</span><br>
                コピーライト / リンク
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Post layout -->
      <div>
        <div style="font-family:var(--mono);font-size:10px;color:#a78bfa;letter-spacing:1.5px;margin-bottom:10px;">POST LAYOUT（記事ページ専用）</div>
        <div style="background:var(--bg2);border:1px solid rgba(124,58,237,0.3);border-radius:8px;padding:12px;">
          <div style="font-family:var(--mono);font-size:11px;color:#a78bfa;margin-bottom:10px;">Post.astro</div>
          <div style="padding-left:14px;border-left:1px dashed var(--border);">
            <div class="vflow">
              <div style="background:var(--surface2);border-radius:5px;padding:8px 10px;font-size:10px;color:var(--dim);">
                BaseHead / Header（継承）
              </div>
              <div class="vflow-arrow" style="font-size:10px;">↓</div>
              <div style="background:var(--surface2);border-radius:5px;padding:8px 10px;font-size:10px;color:var(--dim);">
                記事ヘッダー<br>
                <span style="color:#a78bfa;">TagBadge.astro × N</span>
              </div>
              <div class="vflow-arrow" style="font-size:10px;">↓</div>
              <div style="display:grid;grid-template-columns:1fr auto;gap:6px;">
                <div style="background:rgba(124,58,237,0.08);border:1px dashed rgba(124,58,237,0.3);border-radius:5px;padding:8px 10px;font-size:10px;color:#a78bfa;">
                  &lt;article .prose&gt;<br>Markdownレンダー
                </div>
                <div style="background:var(--surface2);border-radius:5px;padding:8px 10px;font-size:10px;color:var(--dim);width:80px;text-align:center;">
                  <span style="color:#a78bfa;">TOC</span><br>
                  <span style="font-size:9px;">目次</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section-label">STEP 5 — ページとURLの対応（ファイルベースルーティング）</div>
  <div class="diagram">
    <table>
      <thead>
        <tr>
          <th>ファイルパス</th>
          <th>生成されるURL</th>
          <th>役割</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code style="font-family:var(--mono);color:var(--accent);font-size:10px;">pages/index.astro</code></td>
          <td><code style="font-family:var(--mono);font-size:10px;color:var(--dim);">/</code></td>
          <td>TOP：ヒーロー + フィーチャード + 記事グリッド</td>
        </tr>
        <tr>
          <td><code style="font-family:var(--mono);color:var(--accent);font-size:10px;">pages/posts/[...slug].astro</code></td>
          <td><code style="font-family:var(--mono);font-size:10px;color:var(--dim);">/posts/2025-11-28-xxx</code></td>
          <td>記事詳細：本文 + 目次サイドバー</td>
        </tr>
        <tr>
          <td><code style="font-family:var(--mono);color:var(--accent);font-size:10px;">pages/tags/index.astro</code></td>
          <td><code style="font-family:var(--mono);font-size:10px;color:var(--dim);">/tags</code></td>
          <td>タグ一覧：全タグ + 集計数</td>
        </tr>
        <tr>
          <td><code style="font-family:var(--mono);color:var(--accent);font-size:10px;">pages/tags/[tag].astro</code></td>
          <td><code style="font-family:var(--mono);font-size:10px;color:var(--dim);">/tags/AWS, /tags/Linux</code></td>
          <td>タグ別記事一覧（全タグ分を静的生成）</td>
        </tr>
        <tr>
          <td><code style="font-family:var(--mono);color:var(--accent);font-size:10px;">pages/about.astro</code></td>
          <td><code style="font-family:var(--mono);font-size:10px;color:var(--dim);">/about</code></td>
          <td>プロフィール + スキル + 資格リスト</td>
        </tr>
        <tr>
          <td><code style="font-family:var(--mono);color:var(--accent);font-size:10px;">pages/search.astro</code></td>
          <td><code style="font-family:var(--mono);font-size:10px;color:var(--dim);">/search</code></td>
          <td>Pagefind全文検索UI</td>
        </tr>
        <tr>
          <td><code style="font-family:var(--mono);color:var(--accent);font-size:10px;">pages/rss.xml.js</code></td>
          <td><code style="font-family:var(--mono);font-size:10px;color:var(--dim);">/rss.xml</code></td>
          <td>RSSフィード生成</td>
        </tr>
      </tbody>
    </table>

    <div class="callout" style="margin-top:12px;">
      <div class="callout-title">動的ルート（[...slug] / [tag]）の仕組み</div>
      <strong style="color:var(--text);">getStaticPaths()</strong> 関数がビルド時に全記事・全タグを収集し、それぞれのURLを一括生成する。実行時（ランタイム）には一切処理しない純粋な静的ファイルとして出力される。
    </div>
  </div>

  <div class="page-num">4 / 6</div>
</div>

<!-- =============================================================== -->
<!--  PAGE 5 — Step 6〜7: CMS / CI/CD                               -->
<!-- =============================================================== -->
<div class="page">
  <div class="page-header">
    <div class="page-title">Step <span>6〜7</span></div>
    <div class="step-badge">CMS / CI/CD</div>
  </div>

  <div class="section-label">STEP 6 — Decap CMS の認証フロー</div>
  <div class="diagram">
    <div class="flow" style="flex-wrap:nowrap;">
      <div class="flow-item" style="flex:none;width:130px;">
        <div class="flow-item-label">管理者</div>
        <div class="flow-item-text">ブラウザで<br>/admin へアクセス</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-item" style="flex:none;width:130px;">
        <div class="flow-item-label">Decap CMS</div>
        <div class="flow-item-text">GitHub OAuth で<br>認証リクエスト</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-item" style="flex:none;width:130px;">
        <div class="flow-item-label">GitHub</div>
        <div class="flow-item-text">Collaborator権限を<br>確認して許可</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-item" style="flex:none;width:130px;">
        <div class="flow-item-label">執筆・保存</div>
        <div class="flow-item-text">記事をgit commit<br>+ pushを自動実行</div>
      </div>
      <div class="flow-arrow">→</div>
      <div class="flow-item" style="flex:none;width:130px;border-color:rgba(0,229,255,0.4);background:rgba(0,229,255,0.04);">
        <div class="flow-item-label">自動デプロイ</div>
        <div class="flow-item-text">GitHub Actionsが<br>ビルド&公開</div>
      </div>
    </div>

    <div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div class="module-card">
        <div class="module-card-title">public/admin/index.html</div>
        <div class="module-card-role">Decap CMSのSPA本体。CDNからJSを読み込む。CSPは意図的に除外（外部スクリプト必須のため）</div>
      </div>
      <div class="module-card violet">
        <div class="module-card-title">public/admin/config.yml</div>
        <div class="module-card-role">backend（GitHubリポジトリ設定）とcollections（フォームフィールド定義）を記述</div>
      </div>
    </div>
  </div>

  <div class="section-label">STEP 7 — GitHub Actions パイプライン詳細</div>
  <div class="diagram">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;">
      <div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:2px;margin-bottom:10px;">JOB: build</div>
        <div class="vflow">
          <div class="vflow-item">
            <div class="vflow-icon cyan" style="font-size:11px;">①</div>
            <div class="vflow-content">
              <div class="vflow-title">actions/checkout@v4</div>
              <div class="vflow-desc">リポジトリをランナーに取得</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item">
            <div class="vflow-icon cyan" style="font-size:11px;">②</div>
            <div class="vflow-content">
              <div class="vflow-title">actions/setup-node@v4</div>
              <div class="vflow-desc">Node.js 20環境をセットアップ・npmキャッシュ有効化</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item accent">
            <div class="vflow-icon cyan" style="font-size:11px;">③</div>
            <div class="vflow-content">
              <div class="vflow-title">npm ci</div>
              <div class="vflow-desc">package-lock.jsonを厳密適用（改ざん防止・再現性保証）</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item amber">
            <div class="vflow-icon amber" style="font-size:11px;">④</div>
            <div class="vflow-content">
              <div class="vflow-title">npm run build</div>
              <div class="vflow-desc">astro build → dist/ に静的ファイル出力</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item green">
            <div class="vflow-icon green" style="font-size:11px;">⑤</div>
            <div class="vflow-content">
              <div class="vflow-title">npx pagefind --site dist</div>
              <div class="vflow-desc">dist/を解析して検索インデックスを生成</div>
            </div>
          </div>
          <div class="vflow-arrow">↓</div>
          <div class="vflow-item">
            <div class="vflow-icon cyan" style="font-size:11px;">⑥</div>
            <div class="vflow-content">
              <div class="vflow-title">upload-pages-artifact</div>
              <div class="vflow-desc">dist/ をアーティファクトとして保存</div>
            </div>
          </div>
        </div>
      </div>
      <div>
        <div style="font-family:var(--mono);font-size:9px;color:var(--accent);letter-spacing:2px;margin-bottom:10px;">JOB: deploy（needs: build）</div>
        <div class="vflow">
          <div class="vflow-item accent">
            <div class="vflow-icon cyan" style="font-size:11px;">⑦</div>
            <div class="vflow-content">
              <div class="vflow-title">actions/deploy-pages@v4</div>
              <div class="vflow-desc">アーティファクトをGitHub Pagesへ公開</div>
            </div>
          </div>
        </div>

        <div style="margin-top:16px;">
          <div style="font-family:var(--mono);font-size:9px;color:var(--muted);letter-spacing:2px;margin-bottom:10px;">SECURITY（permissions設定）</div>
          <div class="code">
            <div class="code-body"><pre><span class="key">permissions</span>:
  contents: <span class="str">read</span>   <span class="cm"># コード読み取りのみ</span>
  pages: <span class="str">write</span>      <span class="cm"># Pages への書き込み</span>
  id-token: <span class="str">write</span>  <span class="cm"># OIDC認証トークン</span></pre></div>
          </div>
          <div class="callout" style="margin-top:10px;">
            <div class="callout-title">最小権限の原則</div>
            必要な権限のみを付与。仮にActionsが侵害されても被害を最小限に抑える。
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="page-num">5 / 6</div>
</div>

<!-- =============================================================== -->
<!--  PAGE 6 — モジュール依存関係 / セキュリティ                        -->
<!-- =============================================================== -->
<div class="page">
  <div class="page-header">
    <div class="page-title">依存関係 &amp; <span>セキュリティ</span></div>
    <div class="step-badge">ARCHITECTURE</div>
  </div>

  <div class="section-label">モジュール依存関係マップ</div>
  <div class="arch-diagram">
    <!-- Center: Astro -->
    <div style="text-align:center;margin-bottom:10px;">
      <div class="dep-center" style="display:inline-block;min-width:200px;">⚡ astro (core)</div>
    </div>
    <div style="text-align:center;color:var(--muted);font-size:16px;margin-bottom:4px;">↙ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ↓ &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ↘</div>

    <!-- Row 1: integrations -->
    <div class="dep-row">
      <div class="dep-node cyan">@astrojs/mdx<br><span style="font-size:9px;color:var(--muted);">MDX記事対応</span></div>
      <div class="dep-node cyan">astro-expressive-code<br><span style="font-size:9px;color:var(--muted);">コードハイライト</span></div>
      <div class="dep-node violet">@astrojs/sitemap<br><span style="font-size:9px;color:var(--muted);">サイトマップ生成</span></div>
      <div class="dep-node amber">@astrojs/rss<br><span style="font-size:9px;color:var(--muted);">RSSフィード</span></div>
    </div>

    <div style="text-align:center;color:var(--muted);font-size:14px;margin:6px 0;">↓ Vite plugin</div>

    <!-- Row 2: build tools -->
    <div class="dep-row">
      <div class="dep-node cyan">tailwindcss v4<br><span style="font-size:9px;color:var(--muted);">CSSフレームワーク</span></div>
      <div class="dep-node cyan">@tailwindcss/vite<br><span style="font-size:9px;color:var(--muted);">Viteプラグイン</span></div>
      <div class="dep-node">TypeScript<br><span style="font-size:9px;color:var(--muted);">型安全</span></div>
      <div class="dep-node violet">Zod<br><span style="font-size:9px;color:var(--muted);">スキーマ検証</span></div>
    </div>

    <div style="text-align:center;color:var(--muted);font-size:14px;margin:6px 0;">↓ ビルド後に独立実行</div>

    <!-- Row 3: post-build -->
    <div class="dep-row">
      <div class="dep-node green">pagefind<br><span style="font-size:9px;color:var(--muted);">全文検索（WASM）</span></div>
      <div class="dep-node amber">Decap CMS<br><span style="font-size:9px;color:var(--muted);">ヘッドレスCMS</span></div>
      <div class="dep-node">GitHub Actions<br><span style="font-size:9px;color:var(--muted);">CI/CD自動化</span></div>
      <div class="dep-node violet">GitHub Pages<br><span style="font-size:9px;color:var(--muted);">静的ホスティング</span></div>
    </div>
  </div>

  <div class="section-label">セキュリティ設計（多層防御）</div>
  <div class="grid-2">
    <div>
      <table>
        <thead>
          <tr><th>脅威</th><th>対策</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>不正なgit push</td>
            <td><span class="pill pill-cyan">Branch Protection</span> mainブランチを保護</td>
          </tr>
          <tr>
            <td>記事の無断改ざん</td>
            <td><span class="pill pill-violet">GitHub OAuth</span> Collaborator権限で制御</td>
          </tr>
          <tr>
            <td>XSS・スクリプト注入</td>
            <td><span class="pill pill-amber">CSP Header</span> + Astro自動エスケープ</td>
          </tr>
          <tr>
            <td>不正iframeの埋め込み</td>
            <td><span class="pill pill-cyan">frame-src: none</span> で全iframe禁止</td>
          </tr>
          <tr>
            <td>依存パッケージの改ざん</td>
            <td><span class="pill pill-green">npm ci</span> lock厳密適用</td>
          </tr>
          <tr>
            <td>フロントマターの不正値</td>
            <td><span class="pill pill-violet">Zod Schema</span> ビルド時バリデーション</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div>
      <div class="callout">
        <div class="callout-title">CSP（Content Security Policy）</div>
        Base.astro の &lt;head&gt; 内に &lt;meta&gt; タグとして設定。GitHubPagesはHTTPヘッダーをカスタムできないため、HTMLのメタタグで代替。
        <div class="code" style="margin-top:8px;">
          <div class="code-body"><pre style="font-size:9px;"><span class="key">script-src</span>: <span class="str">'self' 'unsafe-inline'</span>
<span class="key">frame-src</span>:  <span class="str">'none'</span>
<span class="key">object-src</span>: <span class="str">'none'</span>
<span class="key">base-uri</span>:   <span class="str">'self'</span></pre></div>
        </div>
      </div>
      <div class="callout" style="border-color: var(--accent3);">
        <div class="callout-title" style="color:var(--accent3);">Decap CMS の admin ページは例外</div>
        /admin は外部CDNからJSを読み込む必要があるため、CSPを意図的に除外している。管理者のみがアクセスするページであり、OAuth認証でアクセス制御されている。
      </div>
    </div>
  </div>

  <div class="page-num">6 / 6</div>
</div>

</body>
</html>`;

writeFileSync(htmlPath, html, 'utf-8');
console.log('HTML written to:', htmlPath);

// Generate PDF with Puppeteer
const browser = await puppeteer.launch({
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
  ],
});

const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

// Wait for fonts to load
await page.evaluate(() => document.fonts.ready);
await new Promise(r => setTimeout(r, 2000));

await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
});

await browser.close();
console.log('PDF generated:', pdfPath);
