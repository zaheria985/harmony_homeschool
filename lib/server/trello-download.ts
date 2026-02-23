import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

function uploadsBaseDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), "public", "uploads");
}

function extFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    if (ext && ext.length <= 5) return ext;
  } catch {}
  return ".bin";
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Download a file from a Trello attachment URL, save locally, return the
 * relative path (servable via /uploads/...).
 *
 * Trello-hosted URLs get key+token appended automatically.
 */
export async function downloadTrelloFile(
  trelloUrl: string,
): Promise<{ localPath: string } | null> {
  const key = process.env.TRELLO_API_KEY || "";
  const token = process.env.TRELLO_TOKEN || "";

  // Trello attachment download endpoint requires OAuth header auth,
  // not query params. Swap trello.com → api.trello.com for the domain.
  const fetchUrl = trelloUrl.replace("https://trello.com/", "https://api.trello.com/");
  const headers: Record<string, string> = {};
  if (key && token) {
    headers["Authorization"] = `OAuth oauth_consumer_key="${key}", oauth_token="${token}"`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    console.log("[trello-download] fetching", trelloUrl.slice(0, 80));
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn("[trello-download] HTTP error", {
        url: trelloUrl.slice(0, 80),
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0) {
      console.warn("[trello-download] empty response", { url: trelloUrl.slice(0, 80) });
      return null;
    }
    if (buffer.byteLength > MAX_FILE_SIZE) {
      console.warn("[trello-download] too large, skipping", {
        url: trelloUrl.slice(0, 80),
        bytes: buffer.byteLength,
      });
      return null;
    }

    const ext = extFromUrl(trelloUrl);
    const filename = `${Date.now()}-${randomUUID()}${ext}`;
    const subdir = "trello";
    const absDir = path.join(uploadsBaseDir(), subdir);
    await mkdir(absDir, { recursive: true });
    await writeFile(path.join(absDir, filename), buffer);

    console.log("[trello-download] saved", {
      file: filename,
      bytes: buffer.byteLength,
    });
    return { localPath: `/uploads/${subdir}/${filename}` };
  } catch (err) {
    console.warn("[trello-download] error", {
      url: trelloUrl.slice(0, 80),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Sleep helper for rate limiting */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
