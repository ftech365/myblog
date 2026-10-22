// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://ftech365.github.io',
  base: '/myblog',  // GitHubリポジトリ名がサブパスになる場合はコメントを外す
  integrations: [
    expressiveCode({
      themes: ['dracula'],
      styleOverrides: {
        borderRadius: '8px',
        frames: {
          frameBoxShadowCssValue: 'none',
        },
      },
    }),
    mdx(),
    sitemap(),
  ],
  markdown: {
    // 注意: 空の remarkPlugins / rehypePlugins では生HTMLの埋め込みは無効化されない
    // （Markdown 内の生HTMLはそのまま出力される）。不正な埋め込みは
    // scripts/check-content.mjs（npm run build の prebuild で実行）でビルド時に検出し、
    // 実行時は BaseHead.astro の CSP でブロックする。
    remarkPlugins: [],
    rehypePlugins: [],
  },
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // 小さな <script> がHTMLにインライン化されると CSP (script-src 'self') でブロックされるため、
      // 常に外部ファイルとして出力させる
      assetsInlineLimit: 0,
    },
  },
});
