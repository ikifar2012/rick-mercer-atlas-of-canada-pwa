import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://rmratlas.mstep.link');
  const sitemap = new URL('/sitemap-index.xml', origin);

  return new Response(`User-agent: *\nAllow: /\nDisallow: /404\nDisallow: /404.html\n\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
};
