---
title: "Astroのファイル構成を理解する — レイアウト・コンポーネント・記事ファイルの関連図"
description: "Astro製ブログのファイル間の関係を整理する。BaseHead・Base・Post・config.tsがどう連携しているか、データがどう流れるかを図解で解説。"
pubDate: 2026-02-25
tags: ["Astro", "ブログ", "フロントエンド", "構成"]
category: "その他"
draft: false
featured: false
---

## はじめに

Astroでブログを構築すると、`Base.astro`・`BaseHead.astro`・`Post.astro`・`config.ts`など複数のファイルが登場する。それぞれが何の役割を持ち、どう連携しているかを把握しておくと、デザイン変更やSEO設定の追加がどこに手を加えればいいか迷わなくなる。

この記事では、FTechNotesのファイル構成を例に、ファイル間の関係とデータの流れを整理する。FTechNotesの技術スタック全体については[FTechNotesの技術構成 — Astro × GitHub Pages でつくる個人技術ブログ](/myblog/posts/2026-02-22-blog-tech-stack)も参照してほしい。

---

## 目次

- [全体の構造図](#全体の構造図)
- [各ファイルの役割](#各ファイルの役割)
- [データの流れ](#データの流れ)
- [どこを変更すればいいか](#どこを変更すればいいか)
- [まとめ](#まとめ)

---

## 全体の構造図

---

ファイル間の関係を図にすると以下のようになる。

```
記事ファイル (.md/.mdx)
　└─ layout指定 → Post.astro（記事ページの外枠）
　　　　　　　　　　├─ Base.astro（HTML全体の外枠）
　　　　　　　　　　│    └─ BaseHead.astro（headの中身）
　　　　　　　　　　└─ 記事本文を <slot /> で受け取る

トップページ (index.astro)
　└─ Base.astro を使用
　　　└─ PostCard.astro などの一覧表示コンポーネントを呼び出す

タグページ
　├─ tags/index.astro  → タグ一覧ページ
　└─ tags/[tag].astro  → タグ別記事一覧ページ

設定・定義
　├─ content/config.ts   → 記事スキーマ（frontmatterの型定義）
　└─ styles/global.css   → CSS変数・デザイントークン
```

大きく「レイアウト系」「ページ系」「設定系」の3グループに分けて考えるとわかりやすい。

---

## 各ファイルの役割

---

### レイアウト系

**BaseHead.astro** はページの `<head>` タグの中身を一手に管理するコンポーネントだ。以下の内容をまとめて出力する。

- charsetやviewportなどの基本metaタグ
- `<title>` タグとdescription
- OGP（SNSシェア時のサムネイル・タイトル）
- Google Analytics（GA4）のトラッキングコード
- sitemapへのリンク
- CSSの読み込み

headに関わる設定を変更したいときは、まずBaseHead.astroを確認する。

**Base.astro** はHTML全体の外枠を担当するレイアウトファイルだ。`<html>`・`<head>`・`<body>` の構造を定義し、headの中身はBaseHeadコンポーネントに委譲している。ヘッダーやフッターもここで管理する。

```html
<html lang="ja">
  <head>
    <BaseHead title={title} description={description} />
  </head>
  <body>
    <Header />
    <slot />  ← ここに各ページの本文が入る
    <Footer />
  </body>
</html>
```

**Post.astro** は記事ページ専用のレイアウトだ。Base.astroをベースにしつつ、記事タイトル・公開日・タグ表示など記事固有の要素を追加している。

---

### ページ系

**index.astro** はトップページだ。記事一覧の取得・表示ロジックを持ち、Base.astroをレイアウトとして使用する。

**tags/index.astro** はタグ一覧ページ、**tags/[tag].astro** はタグ別の記事一覧ページだ。`[tag]` の部分が動的ルーティングになっており、タグの数だけページが自動生成される。

---

### 設定系

**content/config.ts** は記事ファイルのfrontmatterのスキーマ（型定義）を管理する。たとえば `title` は必須・`draft` はbooleanといったルールをここで定義する。記事を追加するときの型チェックをビルド時に行い、必須項目の漏れやタイポがあればエラーで知らせてくれる。

**styles/global.css** はサイト全体のCSS変数・デザイントークンを管理する。色・フォント・余白などの基準値をここで定義しておくことで、全ページで一貫したデザインを維持できる。

---

## データの流れ

---

記事ファイルに書いたfrontmatterの情報がどう各ファイルに渡されるかを追うと、全体の連携が見えてくる。

```
content/config.ts
　└─ frontmatterのスキーマを定義（型チェックの基準）

記事.md のfrontmatter
　（title・description・tagsなど）
　└─ Post.astro に渡される
　　　└─ Base.astro に title・description を渡す
　　　　　└─ BaseHead.astro に渡される
　　　　　　　└─ <title>タグ・OGP・descriptionに展開される
```

たとえば記事のfrontmatterに書いた `title: "記事タイトル"` は、Post.astro → Base.astro → BaseHead.astro と伝播し、最終的にブラウザのタブ名・SNSシェア時のタイトルとして表示される。

---

## どこを変更すればいいか

---

変更したい内容とファイルの対応表だ。

| やりたいこと | 変更するファイル |
|---|---|
| metaタグ・OGPを変更したい | `BaseHead.astro` |
| Google Analyticsを変更・追加したい | `BaseHead.astro` |
| ヘッダー・フッターを変更したい | `Base.astro` |
| 記事ページのデザインを変更したい | `Post.astro` |
| トップページの構成を変更したい | `index.astro` |
| タグページのデザインを変更したい | `tags/[tag].astro` |
| frontmatterに新しい項目を追加したい | `content/config.ts` |
| サイト全体の色・フォントを変更したい | `styles/global.css` |
| プラグインを追加・設定を変更したい | `astro.config.mjs` |

---

## まとめ

---

ファイルの役割を整理すると以下のとおりだ。

- **BaseHead.astro**: headの中身の専任管理者。SEO・OGP・アナリティクスはここ
- **Base.astro**: HTML全体の外枠。ヘッダー・フッターはここ
- **Post.astro**: 記事ページ専用レイアウト
- **config.ts**: frontmatterの型番人。ビルド時に記事の定義ミスを検出
- **global.css**: デザインの基準値管理

「どこを直せばいいかわからない」というときはこの対応表を参照してほしい。
