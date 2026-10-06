import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export interface ReceiptStorage {
  uploadUrl: (key: string, contentType: string) => Promise<string>;
  validateAndCopy: (
    source: string,
    destination: string,
    contentType: string,
    sizeBytes: number,
  ) => Promise<void>;
  downloadUrl: (key: string, contentType: string) => Promise<string>;
  remove: (key: string) => Promise<void>;
}
export function readR2Config(
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const bucket = environment.R2_BUCKET_NAME;
  const endpoint = environment.R2_ENDPOINT;
  const accessKeyId = environment.R2_ACCESS_KEY_ID;
  const secretAccessKey = environment.R2_SECRET_ACCESS_KEY;
  if (!bucket || !endpoint || !accessKeyId || !secretAccessKey)
    throw new Error("Private receipt storage is not configured.");
  const url = new URL(endpoint);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".r2.cloudflarestorage.com")
  )
    throw new Error("Private receipt storage endpoint is invalid.");
  return { bucket, endpoint, accessKeyId, secretAccessKey };
}
export function assertFileSignature(contentType: string, bytes: Uint8Array) {
  const starts = (signature: number[]) =>
    signature.every((byte, index) => bytes[index] === byte);
  const text = new TextDecoder().decode(bytes);
  const valid =
    contentType === "image/png"
      ? starts([137, 80, 78, 71, 13, 10, 26, 10])
      : contentType === "image/jpeg"
        ? starts([255, 216, 255])
        : contentType === "image/webp"
          ? text.startsWith("RIFF") && text.slice(8, 12) === "WEBP"
          : contentType === "application/pdf"
            ? text.startsWith("%PDF-")
            : false;
  if (!valid)
    throw new Error("The file contents do not match the selected file type.");
}
export function createReceiptStorage(config = readR2Config()): ReceiptStorage {
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  const Bucket = config.bucket;
  return {
    uploadUrl: (Key, ContentType) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket, Key, ContentType }), {
        expiresIn: 300,
        signableHeaders: new Set(["content-type"]),
      }),
    validateAndCopy: async (source, destination, contentType, sizeBytes) => {
      const head = await client.send(
        new HeadObjectCommand({ Bucket, Key: source }),
      );
      if (
        head.ContentLength !== sizeBytes ||
        head.ContentType !== contentType ||
        sizeBytes > 10 * 1024 * 1024
      )
        throw new Error(
          "The uploaded file does not match its declared type or size.",
        );
      const prefix = await client.send(
        new GetObjectCommand({
          Bucket,
          Key: source,
          Range: "bytes=0-15",
          IfMatch: head.ETag,
        }),
      );
      assertFileSignature(
        contentType,
        await prefix.Body!.transformToByteArray(),
      );
      // Copy the exact object version inspected above; the upload URL can never overwrite the final key.
      await client.send(
        new CopyObjectCommand({
          Bucket,
          Key: destination,
          CopySource: `${Bucket}/${source}`,
          CopySourceIfMatch: head.ETag,
          MetadataDirective: "REPLACE",
          ContentType: contentType,
          ContentDisposition:
            contentType === "application/pdf"
              ? "attachment; filename=receipt.pdf"
              : "inline",
          CacheControl: "private, no-store",
        }),
      );
    },
    downloadUrl: (Key, contentType) =>
      getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket,
          Key,
          ResponseCacheControl: "private, no-store",
          ResponseContentDisposition:
            contentType === "application/pdf"
              ? "attachment; filename=receipt.pdf"
              : "inline",
        }),
        { expiresIn: 60 },
      ),
    remove: async (Key) => {
      await client.send(new DeleteObjectCommand({ Bucket, Key }));
    },
  };
}
