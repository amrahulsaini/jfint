/**
 * Path prefix support.
 *
 * The VM deployment serves this app under https://34.133.49.19/jecrcfoundation,
 * so Next.js runs with `basePath` set from NEXT_PUBLIC_BASE_PATH. Next prefixes
 * next/link hrefs, router navigations and its own /_next assets automatically —
 * but NOT `fetch()` URLs or plain <a href>. Those go through the helpers below.
 *
 * Leave NEXT_PUBLIC_BASE_PATH unset (Vercel, local dev) and everything stays at
 * the root, unchanged.
 */

export const BASE_PATH = String(process.env.NEXT_PUBLIC_BASE_PATH || '').trim().replace(/\/+$/, '');

/** Prefix a root-relative path with the deployment's base path. */
export function withBasePath(pathname: string): string {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  if (!BASE_PATH) return clean;
  // '/' would otherwise become '/jecrcfoundation/' — harmless but noisy in the URL bar.
  return clean === '/' ? BASE_PATH : `${BASE_PATH}${clean}`;
}

/** Alias used at fetch() call sites, where the intent is "this API route". */
export const api = withBasePath;
