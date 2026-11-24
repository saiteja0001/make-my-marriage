import "server-only";
import {
  CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, HeadObjectCommand,
  PutObjectCommand, S3Client, S3ServiceException,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class R2Unavailable extends Error {}
export class R2ObjectMissing extends Error {}
export class R2ObjectChanged extends Error {}

let configuration: { client: S3Client; bucket: string } | undefined;

function storage() {
  if (configuration) return configuration;
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  if (!account || !/^[a-f0-9]{32}$/i.test(account) || !accessKeyId || !secretAccessKey || !bucket) throw new R2Unavailable();
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  configuration = { client, bucket };
  return configuration;
}

async function objectOperation<T>(run: (connection: ReturnType<typeof storage>) => Promise<T>) {
  try {
    return await run(storage());
  } catch (error) {
    if (error instanceof S3ServiceException) {
      if (error.$metadata.httpStatusCode === 404 && error.name !== "NoSuchBucket") throw new R2ObjectMissing();
      if (error.$metadata.httpStatusCode === 412) throw new R2ObjectChanged();
    }
    throw new R2Unavailable();
  }
}

export function signUpload(key: string, contentType: string, contentLength: number, expiresAt: Date) {
  return objectOperation(({ client, bucket }) => getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket, Key: key, ContentType: contentType, ContentLength: contentLength,
  }), {
    expiresIn: Math.ceil((expiresAt.getTime() - Date.now()) / 1000),
    signableHeaders: new Set(["content-type", "content-length"]),
  }));
}

export function signRead(key: string, attachment?: string) {
  return objectOperation(({ client, bucket }) => getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket, Key: key, ...(attachment && { ResponseContentDisposition: attachment }),
  }), { expiresIn: 15 * 60 }));
}

export function inspectObject(key: string) {
  return objectOperation(async ({ client, bucket }) => {
    const { ContentLength, ContentType, ETag } = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { size: ContentLength, contentType: ContentType, etag: ETag };
  });
}

export function readObjectPrefix(key: string, etag: string) {
  return objectOperation(async ({ client, bucket }) => {
    const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-15", IfMatch: etag }));
    return await result.Body?.transformToByteArray() ?? new Uint8Array();
  });
}

export function copyVerifiedObject(source: string, target: string, etag: string, contentType: string) {
  return objectOperation(async ({ client, bucket }) => {
    await client.send(new CopyObjectCommand({
      Bucket: bucket, Key: target, CopySource: [bucket, ...source.split("/")].map(encodeURIComponent).join("/"),
      CopySourceIfMatch: etag, MetadataDirective: "REPLACE", ContentType: contentType, CacheControl: "private, no-store",
    }));
  });
}

export function removeObject(key: string) {
  return objectOperation(async ({ client, bucket }) => {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  });
}
