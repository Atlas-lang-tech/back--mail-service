// Local dev preview for the vue-email templates. Renders each `.vue` from disk
// on every request (so edits show on refresh) using @vue-email/compiler — the
// same pipeline the worker uses. Run with: `pnpm email:dev`.
//
// The `tw` config below mirrors src/mail/templates/tailwind.tokens.ts (kept inline
// so this plain .mjs script needs no TS loader).

import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { config } from '@vue-email/compiler';

const PORT = Number(process.env.PREVIEW_PORT ?? 3637);
const dir = resolve(process.cwd(), 'src/mail/templates');

const tw = {
  theme: {
    extend: {
      colors: {
        brand: '#4f46e5',
        'brand-dark': '#4338ca',
        'brand-text': '#111827',
        'brand-muted': '#6b7280',
        'brand-bg': '#f6f9fc',
        'brand-border': '#e5e7eb',
      },
    },
  },
};

// Each preview: template file + realistic sample props.
const PREVIEWS = {
  welcome: {
    file: 'welcome.email.vue',
    props: {
      name: 'Andrey',
      verifyUrl: 'https://app.atlas.test/verify-email?token=sample-verify-token',
    },
  },
  'password-reset': {
    file: 'password-reset.email.vue',
    props: {
      resetUrl:
        'https://app.atlas.test/reset-password?token=sample-reset-token',
    },
  },
  'payment-succeeded': {
    file: 'payment-succeeded.email.vue',
    props: {
      invoiceNumber: 'INV-2026-001',
      amountFormatted: '$19.99',
      paidAt: 'June 24, 2026',
    },
  },
};

async function render(key) {
  const compiler = config(dir, { verbose: false });
  const { html } = await compiler.render(PREVIEWS[key].file, {
    props: { ...PREVIEWS[key].props, tw },
  });
  return html;
}

function indexPage() {
  const links = Object.keys(PREVIEWS)
    .map((k) => `<li><a href="/${k}">${k}</a></li>`)
    .join('');
  return `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
  <h1>📧 vue-email preview</h1><ul>${links}</ul></body></html>`;
}

createServer(async (req, res) => {
  const key = (req.url ?? '/').slice(1);
  try {
    if (!key || key === 'favicon.ico') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(indexPage());
      return;
    }
    if (!PREVIEWS[key]) {
      res.writeHead(404, { 'content-type': 'text/html' });
      res.end(`Unknown template "${key}". <a href="/">Back</a>`);
      return;
    }
    const html = await render(key);
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(err?.stack ?? err));
  }
}).listen(PORT, () => {
  console.log(`vue-email preview → http://localhost:${PORT}`);
  for (const k of Object.keys(PREVIEWS)) {
    console.log(`  • http://localhost:${PORT}/${k}`);
  }
});
