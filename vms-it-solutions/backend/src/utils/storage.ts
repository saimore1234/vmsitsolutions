import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import path from "path";
import { env } from "../config/env";

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: env.r2AccessKeyId, secretAccessKey: env.r2SecretAccessKey },
});

export function randomFileName(originalName: string, ext?: string) {
  const extension = ext ?? path.extname(originalName).toLowerCase();
  return crypto.randomBytes(8).toString("hex") + extension;
}

/** Uploads a buffer to R2 under `key` (e.g. "branding/abc123.webp") and returns its public URL. */
export async function uploadToStorage(key: string, buffer: Buffer, contentType: string): Promise<string> {
  await s3.send(new PutObjectCommand({ Bucket: env.r2Bucket, Key: key, Body: buffer, ContentType: contentType }));
  return `${env.r2PublicUrl}/${key}`;
}

/** Deletes an object by key. Non-fatal if it's already gone. */
export async function deleteFromStorage(key: string): Promise<void> {
  try {
    await s3.send(new DeleteObjectCommand({ Bucket: env.r2Bucket, Key: key }));
  } catch {
    /* already gone or unreachable — not worth failing the caller's request over */
  }
}

/** Recovers the object key from a previously-issued public URL, for deletion. */
export function storageKeyFromUrl(url: string): string {
  return url.startsWith(env.r2PublicUrl) ? url.slice(env.r2PublicUrl.length + 1) : url;
}
