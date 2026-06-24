// Minimal brand design tokens shared between the transactional emails and the
// Vue 3 + Tailwind 4 front-end. Keep these values in sync with the front-end
// Tailwind theme (brand colours + fonts). They are passed into each template's
// <ETailwind :config="..."> wrapper by `render.ts`, so a single source of truth
// styles every email without importing this file from inside a .vue at runtime.

export const brand = {
  primary: '#4f46e5', // indigo-600
  primaryDark: '#4338ca', // indigo-700
  text: '#111827', // gray-900
  muted: '#6b7280', // gray-500
  background: '#f6f9fc',
  surface: '#ffffff',
  border: '#e5e7eb', // gray-200
  fontFamily:
    "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
} as const;

/** TailwindConfig consumed by `@vue-email/tailwind`'s <ETailwind> component. */
export const brandTailwindConfig = {
  theme: {
    extend: {
      colors: {
        brand: brand.primary,
        'brand-dark': brand.primaryDark,
        'brand-text': brand.text,
        'brand-muted': brand.muted,
        'brand-bg': brand.background,
        'brand-border': brand.border,
      },
      fontFamily: {
        sans: brand.fontFamily.split(',').map((f) => f.trim()),
      },
    },
  },
};
