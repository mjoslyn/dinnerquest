import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://mjoslyn.github.io',
  output: 'static',  // Static pages by default, API routes with prerender=false are serverless
  adapter: netlify(),
  integrations: [mdx()],
  build: {
    format: 'directory'
  }
});
