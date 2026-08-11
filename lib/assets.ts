/**
 * Asset URL resolution.
 *
 * Student photos and admission-form PDFs (~450 MB) are too large to ship in the
 * Vercel deployment, so they live in a Cloudflare R2 bucket instead of public/.
 * Set NEXT_PUBLIC_ASSET_BASE_URL to the bucket's public base URL and every asset
 * path below is served from there. Leave it unset and paths stay relative, which
 * keeps local development (and the old VM layout) working unchanged.
 */

import { withBasePath } from '@/lib/base-path';

const BASE = String(process.env.NEXT_PUBLIC_ASSET_BASE_URL || '').trim().replace(/\/+$/, '');

/**
 * Resolve a public-relative path (e.g. "/student_photos/x.jpg") to its served URL.
 * With no asset host configured the file is served by the app itself, so it still
 * needs the deployment's base path — Next does not rewrite raw <img src>.
 */
export function assetUrl(pathname: string): string {
  const clean = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return BASE ? `${BASE}${clean}` : withBasePath(clean);
}

/** Resolve the photo for a roll number within a given photo directory. */
export function studentPhotoUrl(photoDir: string, rollNo: string): string {
  return assetUrl(`/${photoDir}/photo_${rollNo}.jpg`);
}
