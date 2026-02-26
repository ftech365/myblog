// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import expressiveCode from 'astro-expressive-code';
import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  site: 'https://YOUR_USERNAME.github.io',
  // base: '/YOUR_REPO_NAME',  // GitHubリポジトリ名がサブパスになる場合はコメントを外す
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
    // 生HTMLの埋め込みを無効化（不正な<script>タグ等を防ぐ）
    remarkPlugins: [],
    rehypePlugins: [],
  },
  build: {
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
