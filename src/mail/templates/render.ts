import { resolve } from 'node:path';
import { config } from '@vue-email/compiler';
import type { TemplateKey } from '../../queue/mail-queue.constants.js';
import { brandTailwindConfig } from './tailwind.tokens.js';

// `.vue` templates are compiled from disk at runtime (vue/compiler-sfc), so the
// source files must be present. Defaults to the in-repo path; override with
// MAIL_TEMPLATES_DIR in containers that ship the templates elsewhere.
const templatesDir =
  process.env.MAIL_TEMPLATES_DIR ??
  resolve(process.cwd(), 'src/mail/templates');

const compiler = config(templatesDir, { verbose: false });

const TEMPLATE_FILE: Record<TemplateKey, string> = {
  welcome: 'welcome.email.vue',
  'password-reset': 'password-reset.email.vue',
  'payment-succeeded': 'payment-succeeded.email.vue',
};

const TEMPLATE_SUBJECT: Record<TemplateKey, string> = {
  welcome: 'Welcome to Atlas — confirm your email',
  'password-reset': 'Reset your Atlas password',
  'payment-succeeded': 'Your Atlas payment receipt',
};

/** Static subject line for a given template. */
export function subjectFor(key: TemplateKey): string {
  return TEMPLATE_SUBJECT[key];
}

/**
 * Render a `.vue` template to final table-based HTML. The shared brand Tailwind
 * config is injected as `tw` so every template styles from one source of truth.
 */
export async function renderTemplate(
  key: TemplateKey,
  props: Record<string, unknown>,
): Promise<string> {
  const { html } = await compiler.render(TEMPLATE_FILE[key], {
    props: { ...props, tw: brandTailwindConfig },
  });
  return html;
}
