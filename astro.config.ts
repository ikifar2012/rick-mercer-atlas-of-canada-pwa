import react from '@astrojs/react';
import { defineConfig } from 'astro/config';

const site = process.env.PUBLIC_SITE_URL ?? 'https://rick-mercer-atlas-of-canada-pwa.workers.dev';

export default defineConfig({
  site,
  output: 'static',
  integrations: [
    react()
  ],
  vite: { build: { sourcemap: true } }
});
