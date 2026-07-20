import { defineConfig, passthroughImageService } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

// Hybrid rendering: pages are prerendered (static, cheap, SEO-friendly) by
// default; routes that need a server opt in with `export const prerender = false`
// (e.g. the report/search/geocode/flag APIs). Deployed on Cloudflare Pages.
export default defineConfig({
  site: process.env.PUBLIC_SITE_URL || 'https://www.findmypetcy.com',
  output: 'hybrid',
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [sitemap({ filter: (page) => !page.includes('/admin') })],
  // We serve plain <img> tags (no astro:assets), so skip the Sharp service
  // that Cloudflare's runtime can't use.
  image: { service: passthroughImageService() },
  devToolbar: { enabled: false },
});
