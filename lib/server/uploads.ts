import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

function extensionFor(file: File): string {
  const fromName = path.extname(file.name || "").toLowerCase();
  if (fromName) return fromName;

  if (file.type === "image/jpeg") return ".jpg";
  if (file.type === "image/png") return ".png";
  if (file.type === "image/webp") return ".webp";
  if (file.type === "image/gif") return ".gif";
  return ".bin";
}

export async function saveUploadedImage(
  file: File | null,
  subdir: "children" | "subjects" | "curricula" | "resources"
): Promise<{ path: string } | { error: string } | null> {
  if (!file || file.size === 0) return null;

  if (!file.type.startsWith("image/")) {
    return { error: "Upload must be an image file" };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return { error: "Image must be 10MB or smaller" };
  }

  const ext = extensionFor(file);
  const filename = `${Date.now()}-${randomUUID()}${ext}`;
  const relativePath = `/uploads/${subdir}/${filename}`;
  const absDir = path.join(process.cwd(), "public", "uploads", subdir);
  const absPath = path.join(absDir, filename);

  try {
    await mkdir(absDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(absPath, Buffer.from(bytes));
  } catch {
    return { error: "Failed to save uploaded image" };
  }

  return { path: relativePath };
}
