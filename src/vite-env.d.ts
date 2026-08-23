/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  // VITE_ADMIN_KEY removed from the bundle (audit 2026-08-15, finding #52).
  // The admin UI now authenticates with a JWT from /api/auth?action=login.
  // Do not re-add this property; if a cron script needs the legacy header,
  // it MUST read ADMIN_KEY from process.env at runtime, not from the bundle.
  readonly VITE_STRIPE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
