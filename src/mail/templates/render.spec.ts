import { renderTemplate, subjectFor } from './render.js';

// These render real `.vue` SFCs through @vue-email/compiler (vue/compiler-sfc),
// so they double as a smoke test of the template pipeline.
describe('renderTemplate', () => {
  it('renders the welcome email', async () => {
    const html = await renderTemplate('welcome', {
      name: 'Andrey',
      verifyUrl: 'https://app.example.com/verify-email?token=tok-123',
    });

    expect(html).toContain('Verify email');
    expect(html).toContain(
      'https://app.example.com/verify-email?token=tok-123',
    );
    expect(html).toMatchSnapshot();
  });

  it('renders the password-reset email', async () => {
    const html = await renderTemplate('password-reset', {
      resetUrl: 'https://app.example.com/reset-password?token=tok-456',
    });

    expect(html).toContain('Reset password');
    expect(html).toContain(
      'https://app.example.com/reset-password?token=tok-456',
    );
    expect(html).toMatchSnapshot();
  });

  it('renders the payment-succeeded email', async () => {
    const html = await renderTemplate('payment-succeeded', {
      invoiceNumber: 'INV-2026-001',
      amountFormatted: '$19.99',
      paidAt: 'June 24, 2026',
    });

    expect(html).toContain('INV-2026-001');
    expect(html).toContain('$19.99');
    expect(html).toMatchSnapshot();
  });

  it('exposes a subject per template', () => {
    expect(subjectFor('welcome')).toMatch(/Welcome/);
    expect(subjectFor('password-reset')).toMatch(/Reset/);
    expect(subjectFor('payment-succeeded')).toMatch(/receipt/);
  });
});
