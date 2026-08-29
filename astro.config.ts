import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

const site = process.env.PUBLIC_SITE_URL ?? 'https://rmratlas.mstep.link';

export default defineConfig({
  site,
  output: 'static',
  integrations: [
    react(),
    sitemap({
      // The 404 page is intentionally excluded; everything else is indexable.
      filter: (page) => !page.endsWith('/404/') && !page.endsWith('/404')
    })
  ],
  vite: { build: { sourcemap: true } }
});
