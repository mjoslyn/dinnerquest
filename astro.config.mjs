import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://mjoslyn.github.io',
  output: 'static',
  adapter: netlify(),
  integrations: [mdx()],
  build: {
    format: 'directory'
  }
});
