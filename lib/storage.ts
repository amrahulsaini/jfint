/**
 * Object storage for student photos.
 *
 * On Vercel the filesystem is read-only, so photos captured by the admission-card
 * extractor cannot be written into public/. When R2 credentials are configured
 * they are uploaded to the Cloudflare R2 bucket instead; otherwise we fall back to
 * writing under public/, which is what the old VM deployment did.
 */
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const ACCOUNT_ID = String(process.env.R2_ACCOUNT_ID || '').trim();
const ACCESS_KEY_ID = String(process.env.R2_ACCESS_KEY_ID || '').trim();
const SECRET_ACCESS_KEY = String(process.env.R2_SECRET_ACCESS_KEY || '').trim();
const BUCKET = String(process.env.R2_BUCKET || '').trim();

let client: S3Client | null = null;

export function isR2Configured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET);
}

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: ACCESS_KEY_ID, secretAccessKey: SECRET_ACCESS_KEY },
    });
  }
  return client;
}

/**
 * Store an object at a public-relative key (e.g. "1styearphotos/photo_X.jpg").
 * Uses R2 when configured, else the local public/ directory.
 */
export async function putPublicObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const cleanKey = key.replace(/^\/+/, '');

  if (isR2Configured()) {
    await getClient().send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: cleanKey,
      Body: body,
      ContentType: contentType,
    }));
    return;
  }

  const filePath = path.join(process.cwd(), 'public', cleanKey);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, body);
}
