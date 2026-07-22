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

// Only Trello-hosted URLs may be fetched. Without this allowlist the function
// is a server-side request forgery primitive: a caller-supplied URL is fetched
// by the server and its body written into the public uploads directory.
const ALLOWED_HOSTS = new Set(["trello.com", "api.trello.com"]);
const ALLOWED_HOST_SUFFIXES = [".trellocdn.com"];

function isAllowedTrelloUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(host)) return true;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

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

  if (!isAllowedTrelloUrl(trelloUrl)) {
    console.warn("[trello-download] refused non-Trello URL", trelloUrl.slice(0, 80));
    return null;
  }

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
    // Follow redirects manually so each hop can be re-checked against the
    // allowlist — an open redirect on a Trello host must not bounce us out.
    let response = await fetch(fetchUrl, {
      signal: controller.signal,
      redirect: "manual",
      headers,
    });

    let redirectHops = 0;
    while (
      response.status >= 300 &&
      response.status < 400 &&
      response.headers.get("location") &&
      redirectHops < 5
    ) {
      const location = new URL(
        response.headers.get("location") as string,
        response.url || fetchUrl
      ).toString();
      if (!isAllowedTrelloUrl(location)) {
        clearTimeout(timeout);
        console.warn("[trello-download] refused redirect target", location.slice(0, 80));
        return null;
      }
      redirectHops += 1;
      response = await fetch(location, {
        signal: controller.signal,
        redirect: "manual",
        headers,
      });
    }
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
