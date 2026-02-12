import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
]);

function uploadsBaseDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), "public", "uploads");
}

function extensionFor(file: File): string {
  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  if (file.type === "image/avif") return ".avif";
  if (file.type === "image/svg+xml") return ".svg";

  const fromName = path.extname(file.name || "").toLowerCase();
  if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".svg"].includes(fromName)) {
    return fromName === ".jpeg" ? ".jpg" : fromName;
  }

  return ".jpg";
}

export async function saveUploadedImage(
  file: File | null,
  subdir: "children" | "subjects" | "curricula" | "resources"
): Promise<{ path: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;

  if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return { error: "Unsupported image format. Please upload JPG, PNG, WEBP, GIF, AVIF, or SVG." };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { error: "Image must be 10MB or smaller" };
  }

  const ext = extensionFor(file);
  const filename = `${Date.now()}-${randomUUID()}${ext}`;
  const relativePath = `/uploads/${subdir}/${filename}`;
  const absDir = path.join(uploadsBaseDir(), subdir);
  const absPath = path.join(absDir, filename);

  try {
    await mkdir(absDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(absPath, Buffer.from(bytes));
  } catch (error) {
    console.error("Failed to save uploaded image", {
      subdir,
      absPath,
      error,
    });
    return { error: "Failed to save uploaded image" };
  }

  return { path: relativePath };
}
