import { createAuthClient } from "better-auth/react";

/**
 * No baseURL by default — better-auth's client falls back to same-origin
 * (window.location.origin) in the browser, which is always correct
 * regardless of which port the app actually got served on. A hardcoded
 * NEXT_PUBLIC_APP_URL broke sign-up/sign-in ("Failed to fetch") any time
 * the dev server ran on a different port than whatever was baked into
 * .env at build time (e.g. the configured port was already taken and a
 * different one got auto-assigned). Only set NEXT_PUBLIC_APP_URL if the
 * app is genuinely served from a different origin than the API (rare).
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || undefined,
});
