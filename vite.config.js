import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // lets the Cloudflare "quick tunnel" (npx cloudflared tunnel --url ...)
    // reach the dev server — its hostname changes every time the tunnel is
    // restarted, so this allows the whole trycloudflare.com domain rather
    // than one specific subdomain
    allowedHosts: ['.trycloudflare.com'],
  },
});
