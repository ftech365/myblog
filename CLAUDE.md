# 技術ブログ構築プロジェクト

このファイルはClaude Codeへの指示書です。
プロジェクトディレクトリのルートに配置して `claude` を起動すると、コンテキストとして自動的に読み込まれます。

---

## プロジェクト概要

個人向けインフラ・資格系の技術ブログ。  
**Astro + Decap CMS + GitHub Pages** 構成で構築する。

### 主な要件
- **テーマ**: AWS / Linux / Terraform / Kubernetes / 資格取得記録 など
- **執筆方法**: 以下の2パターンに対応（詳細は「コンテンツ作成ガイド」セクション参照）
  - Claude Code CLI から記事を生成・編集する
  - Decap CMS の管理画面 または エディタで手動執筆する
- **ホスティング**: GitHub Pages
- **言語**: 日本語のみ
- **デザイン**: ダーク系（黒・ネイビー）、おしゃれ・個性的

### 必要な機能
- タグ・カテゴリ分類
- 全文検索（Pagefind）
- ダークモード（デフォルトON）
- コードシンタックスハイライト
- OGP対応（SNSシェア用）

### セキュリティ要件（必須）
- **記事改変の防止**: オーナー本人以外は記事を変更・追加できない
- **不正リンク・埋め込みの防止**: XSS・コンテンツインジェクションを構造的にブロックする
- **各コンポーネントのベストプラクティス遵守**: Astro / GitHub / Decap CMS それぞれの推奨設定を適用する

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| フレームワーク | [Astro](https://astro.build/) v4.x |
| スタイリング | Tailwind CSS v3 |
| CMS | Decap CMS（管理画面: `/admin`） |
| 検索 | Pagefind |
| ホスティング | GitHub Pages |
| CI/CD | GitHub Actions |
| シンタックスハイライト | Expressive Code（Astroプラグイン） |

---

## デザイン仕様

モックアップ（`mockup/tech-blog-mockup.html`）を参照しながら実装すること。

### カラーパレット（CSS変数）
```css
:root {
  --bg:       #080c14;   /* メイン背景 */
  --bg2:      #0d1220;
  --surface:  #151d2e;   /* カード背景 */
  --border:   #1e2d47;   /* ボーダー */
  --accent:   #00e5ff;   /* シアン（メインアクセント） */
  --accent2:  #7c3aed;   /* バイオレット */
  --accent3:  #f59e0b;   /* アンバー */
  --text:     #e2e8f0;
  --text-dim: #94a3b8;
  --text-muted: #64748b;
}
```

### フォント
- **Display**: Bebas Neue（ロゴ・見出し）
- **Mono**: Space Mono（タグ・コード）
- **Body**: Noto Sans JP（本文）

### ページ構成
1. **TOP（記事一覧）** — ヒーロー + フィーチャード記事 + 3カラムグリッド
2. **記事詳細** — 本文 + 目次サイドバー + 関連記事
3. **タグ/カテゴリ一覧** — タグフィルター + 記事リスト
4. **About** — プロフィールページ

---

## ディレクトリ構成（目標）

```
/
├── public/
│   ├── admin/
│   │   ├── index.html       # Decap CMS管理画面
│   │   └── config.yml       # CMSの設定
│   └── fonts/
├── src/
│   ├── components/
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── PostCard.astro
│   │   ├── TagBadge.astro
│   │   └── TableOfContents.astro
│   ├── layouts/
│   │   ├── Base.astro       # 共通レイアウト
│   │   └── Post.astro       # 記事レイアウト
│   ├── pages/
│   │   ├── index.astro      # TOP
│   │   ├── posts/
│   │   │   └── [...slug].astro
│   │   ├── tags/
│   │   │   └── [tag].astro
│   │   └── about.astro
│   ├── content/
│   │   ├── config.ts        # コンテンツスキーマ
│   │   └── posts/           # Markdownの記事
│   └── styles/
│       └── global.css
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actionsデプロイ設定
├── astro.config.mjs
├── tailwind.config.mjs
└── package.json
```

---

## 構築ステップ

以下の順序で実装を進めること。

### Step 1: プロジェクト初期化
```bash
npm create astro@latest . -- --template blog --typescript strict
npx astro add tailwind
npx astro add sitemap
```

### Step 2: 依存パッケージの追加
```bash
npm install @astrojs/rss
npm install astro-expressive-code
npm install pagefind
```

### Step 3: コンテンツスキーマの定義（`src/content/config.ts`）
```typescript
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

### Step 4: デザイン実装
- `global.css` でCSS変数・フォントを設定
- `Base.astro` でHeader/Footer/メタタグを共通化
- `PostCard.astro` でカード型UIを実装
- `TagBadge.astro` でタグバッジを実装

### Step 5: ページ実装
- `index.astro`: 記事一覧（フィーチャード + グリッド）
- `posts/[...slug].astro`: 記事詳細（目次自動生成）
- `tags/[tag].astro`: タグ別一覧

### Step 6: Decap CMS設定（`public/admin/config.yml`）
```yaml
backend:
  name: github
  repo: YOUR_GITHUB_USERNAME/YOUR_REPO_NAME
  branch: main

media_folder: public/images
public_folder: /images

collections:
  - name: posts
    label: 記事
    folder: src/content/posts
    create: true
    slug: "{{year}}-{{month}}-{{day}}-{{slug}}"
    fields:
      - { label: タイトル, name: title, widget: string }
      - { label: 説明, name: description, widget: text }
      - { label: 投稿日, name: pubDate, widget: datetime }
      - { label: タグ, name: tags, widget: list, default: [] }
      - { label: カテゴリ, name: category, widget: string, required: false }
      - { label: 本文, name: body, widget: markdown }
      - { label: 下書き, name: draft, widget: boolean, default: false }
```

### Step 7: GitHub Actions（`.github/workflows/deploy.yml`）
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - name: Run Pagefind
        run: npx pagefind --site dist
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

### Step 8: 検索機能（Pagefind）
ビルド後に `npx pagefind --site dist` を実行することで全文検索インデックスが生成される。
検索UIは `src/components/Search.astro` に実装し、Pagefindのデフォルトウィジェットを使用。

---

## サンプル記事

`src/content/posts/` に以下のサンプル記事を作成して動作確認に使うこと。

```markdown
---
title: "AWS SAA 一発合格までの学習ロードマップ"
description: "3ヶ月で一発合格した勉強法を全公開。使った教材、模擬試験の回し方、苦手分野の潰し方まで惜しみなく書いた。"
pubDate: 2025-11-28
tags: ["AWS", "SAA", "資格"]
category: "資格"
draft: false
---

## なぜSAAを受けたか

...
```

---

## Claude Codeへの起動メッセージ

このプロジェクトを開始する際に以下のプロンプトをそのまま使用できる:

```
このCLAUDE.mdを読んで、技術ブログプロジェクトをゼロから構築してください。
まずStep 1のプロジェクト初期化から始めて、各ステップを順番に実装してください。
デザインはmockup/tech-blog-mockup.htmlを参照しながら、同じカラーパレットとフォントを使って実装してください。
```

---

## セキュリティ設計

### 脅威モデルと対策の全体像

```
[攻撃者] → GitHubリポジトリへの不正push  → Branch Protection Rules でブロック
[攻撃者] → Decap CMS経由の記事改ざん    → GitHub OAuth + Collaborator権限制御でブロック
[攻撃者] → XSS / スクリプト注入         → CSP ヘッダー + Astro の自動エスケープでブロック
[攻撃者] → 不正iframeの埋め込み         → CSP frame-src 制限でブロック
[攻撃者] → 外部リソースの勝手な読み込み  → CSP default-src 制限でブロック
[攻撃者] → 管理画面への不正アクセス     → GitHub OAuth 認証必須でブロック
```

---

### 1. GitHubリポジトリの保護設定

#### リポジトリをPrivateにする
個人ブログはリポジトリをPrivateにするのが最もシンプルな保護。  
GitHub Pages は Private リポジトリでも無料プランで公開可能。

```
GitHub リポジトリ → Settings → General → Danger Zone
→ "Change repository visibility" → Private に変更
```

#### Branch Protection Rules（mainブランチの保護）
```
Settings → Branches → Add branch protection rule
Branch name pattern: main

設定項目:
☑ Require a pull request before merging
☑ Require approvals: 1（自分だけのリポジトリなら0でも可）
☑ Require status checks to pass before merging
☑ Require branches to be up to date before merging
☑ Do not allow bypassing the above settings
☑ Restrict who can push to matching branches → 自分のGitHubアカウントのみ
```

#### Collaboratorを追加しない
他者を Collaborator に追加しない限り、GitHub認証があっても記事を変更できない。  
**これが最も重要な設定。**

---

### 2. Decap CMS の認証設定

#### GitHub OAuth Appの設定
Decap CMSはGitHub OAuthを使って認証する。以下の設定で自分以外はログインしても操作できない。

```yaml
# public/admin/config.yml
backend:
  name: github
  repo: YOUR_USERNAME/YOUR_REPO   # Privateリポジトリ名
  branch: main
  # OAuth後のアクセスはGitHubのCollaborator権限で制御されるため
  # Collaboratorに追加されていない人は認証後も操作不可
```

#### 管理画面URLの難読化（任意）
`/admin` というパスは一般的すぎるため、カスタムパスに変更することで存在を隠せる。

```yaml
# astro.config.mjs に追記
// public/admin/ を public/manage-xxxxxxxx/ にリネームし
// decap cms の設定もそのパスに合わせる
```

---

### 3. Astro の Content Security Policy (CSP) 設定

不正スクリプト・不正iframe・外部リソースの読み込みをHTTPヘッダーレベルでブロックする。

#### `public/_headers` ファイルを作成（GitHub Pages用）

GitHub Pages は `_headers` ファイルをサポートしていないが、
`<meta http-equiv>` タグで同等の効果を得られる。
`src/layouts/Base.astro` の `<head>` に以下を追加する:

```astro
---
// Base.astro
---
<head>
  <!-- Content Security Policy -->
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https:;
    frame-src 'none';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    upgrade-insecure-requests;
  ">
  <!-- クリックジャッキング対策 -->
  <meta http-equiv="X-Frame-Options" content="DENY">
  <!-- MIMEタイプスニッフィング対策 -->
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <!-- リファラー情報の制限 -->
  <meta name="referrer" content="strict-origin-when-cross-origin">
</head>
```

> **注意**: Decap CMS の管理画面（`/admin`）は外部スクリプトを読み込むため、
> `public/admin/index.html` には上記CSPを適用しないこと。管理画面は自分だけが使うページ。

---

### 4. Astro のコンテンツエスケープ設定

Astro はデフォルトで変数をHTMLエスケープするが、Markdownのレンダリングでは追加設定が必要。

#### `astro.config.mjs` のセキュア設定

```javascript
// astro.config.mjs
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';

export default defineConfig({
  site: 'https://YOUR_USERNAME.github.io',
  base: '/YOUR_REPO_NAME',  // リポジトリ名がサブパスになる場合
  integrations: [
    expressiveCode(),
    tailwind(),
    sitemap(),
  ],
  markdown: {
    // シンタックスハイライト
    syntaxHighlight: 'shiki',
    shikiConfig: { theme: 'dracula' },
    // 生HTMLの埋め込みを禁止（不正な<script>タグなどを防ぐ）
    remarkPlugins: [],
    rehypePlugins: [],
  },
  // ビルド時の設定
  build: {
    // インラインスタイルを外部CSSに分離（CSP適用しやすくなる）
    inlineStylesheets: 'never',
  },
});
```

#### `src/content/config.ts` でのスキーマバリデーション

フロントマターに不正な値が混入しないよう、Zodスキーマで厳密にバリデートする:

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';

const posts = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(1).max(100),
    description: z.string().min(1).max(300),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage: z.string().url().optional(),  // URLバリデーション付き
    tags: z.array(z.string().max(30)).max(10).default([]),
    category: z.enum([
      "AWS", "Linux", "Terraform", "Kubernetes",
      "ネットワーク", "セキュリティ", "資格", "監視・運用", "その他"
    ]).optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

---

### 5. GitHub Actions のセキュア設定

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

# 最小権限の原則: 必要な権限のみ付与
permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm

      # package-lock.json を厳密に使用（依存関係の改ざん防止）
      - run: npm ci

      # ビルド
      - run: npm run build

      # 検索インデックス生成
      - name: Run Pagefind
        run: npx pagefind --site dist

      # ビルド成果物のアップロード
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

---

### 6. セキュリティ設定チェックリスト

実装後に以下をすべて確認すること。

#### GitHub設定
- [ ] リポジトリを **Private** に設定した
- [ ] main ブランチの **Branch Protection Rules** を有効にした
- [ ] 自分以外の Collaborator を **追加していない**
- [ ] GitHub Actions の権限が **最小限（read/write必要分のみ）** になっている

#### Decap CMS設定
- [ ] `config.yml` の `repo:` が正しいリポジトリ名になっている
- [ ] GitHub OAuth App を設定した
- [ ] 管理画面URLを確認し、不要であれば難読化した

#### Astro設定
- [ ] `Base.astro` に **CSPメタタグ** を追加した
- [ ] `X-Frame-Options: DENY` を設定した
- [ ] コンテンツスキーマに **Zodバリデーション** を追加した
- [ ] `astro.config.mjs` で **生HTMLの埋め込みを制限** した

#### 定期メンテナンス
- [ ] 月1回: `npm audit` で依存パッケージの脆弱性を確認する
- [ ] 月1回: GitHub の Security タブでアラートを確認する
- [ ] 半年ごと: 使用パッケージを `npm update` でアップデートする

---

## コンテンツ作成ガイド

記事の作成・編集には **パターンA（Claude Code）** と **パターンB（手動）** の2通りがある。どちらで作成した記事も `src/content/posts/` に配置された `.md` ファイルとして管理されるため、混在して使って構わない。

---

### パターンA: Claude Code で記事を生成する

ターミナルでプロジェクトルートに移動し `claude` を起動した状態で、以下のプロンプト例を使う。

#### 記事の雛形を作成する
```
「TerraformでS3バケットを作成する手順」というタイトルで記事の雛形を作成してください。
タグは ["Terraform", "AWS", "IaC"] で、src/content/posts/ にMarkdownファイルとして保存してください。
```

#### 既存のメモから記事に仕上げる
```
以下のメモを技術ブログ記事に仕上げてください。フロントマターも含めて src/content/posts/2025-12-01-lpic1.md に保存してください。

---
[ここに手書きメモや箇条書きを貼り付ける]
---
```

#### 複数記事をまとめて生成する
```
以下のテーマで3本の記事雛形を一括作成してください。それぞれ src/content/posts/ に保存してください。
1. LPIC-1 合格体験記
2. AWS VPC の設計パターン
3. Ansible で冪等性のある構成管理をする方法
```

#### Claude Code が自動で行うこと
記事生成時に Claude Code は以下を自動処理する:
- フロントマター（title / description / pubDate / tags / category / draft）の生成
- ファイル名の日付プレフィックス付与（例: `2025-12-01-terraform-s3.md`）
- コードブロックへの言語指定
- 見出し構造（H2 / H3）の整理

---

### パターンB: 手動で記事を書く

#### B-1: エディタ（VSCode など）で直接書く

`src/content/posts/` 配下に `.md` ファイルを新規作成し、以下のフロントマターから書き始める。

```markdown
---
title: "記事タイトル"
description: "記事の概要（OGPにも使われる）"
pubDate: 2025-12-01
updatedDate: 2025-12-05   # 任意
tags: ["AWS", "資格"]
category: "資格"
draft: false              # true にすると公開されない
---

## 見出し

本文...
```

**ファイル名の命名規則**: `YYYY-MM-DD-slug名.md`  
例: `2025-12-01-aws-saa-study.md`

#### B-2: Decap CMS 管理画面から書く

ブログを GitHub Pages にデプロイした後、`https://あなたのドメイン/admin` にアクセスすると管理画面が使える。

管理画面でできること:
- リッチなMarkdownエディタで執筆
- 画像のアップロード・挿入
- タグ・カテゴリの選択
- 下書き保存 → 公開のワークフロー
- 投稿するとGitHubリポジトリに自動でコミット・プッシュされる

> **初回セットアップが必要**: Decap CMS を使うには GitHub OAuth App の設定が別途必要。
> 詳細は [Decap CMS ドキュメント](https://decapcms.org/docs/github-backend/) を参照。

---

### 執筆後の公開フロー

どちらのパターンで書いた場合も、公開フローは同じ。

```
記事をsrc/content/posts/に保存
      ↓
git add . && git commit -m "記事追加: タイトル"
git push origin main
      ↓
GitHub Actions が自動でビルド & デプロイ
      ↓
GitHub Pages に公開される（数分後）
```

> **Decap CMS 経由の場合**: 管理画面で「公開」を押すと自動でコミット・プッシュまで行われるため、git操作は不要。

---

### 下書き管理

`draft: true` にしたファイルはビルド時に除外されるため、公開せずにリポジトリで管理できる。  
Claude Code で下書きを確認・編集する場合:

```
draft: true の記事を一覧表示して、「LPIC-1」の記事を続きから書いてください。
```

---

## 注意事項

- `public/admin/config.yml` の `repo:` は必ず実際のGitHubリポジトリ名に変更すること
- GitHub Pages を有効にするには、リポジトリの Settings → Pages → Source を「GitHub Actions」に設定すること
- Decap CMS を使うには GitHub OAuth App の設定が別途必要（または Netlify Identity を使う方法もある）
