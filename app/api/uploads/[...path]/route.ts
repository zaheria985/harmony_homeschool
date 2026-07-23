import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

function uploadsBaseDir(): string {
  return process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.join(process.cwd(), "public", "uploads");
}

// Extensions safe to render inline. SVG is deliberately excluded: an inline
// SVG can carry <script>, so a stored SVG would be a persistent XSS vector.
const INLINE_MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const segments = params.path;
  // Prevent directory traversal
  if (segments.some((s) => s === ".." || s.includes("/"))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const filePath = path.join(uploadsBaseDir(), ...segments);

  try {
    const buffer = await readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const inlineType = INLINE_MIME_TYPES[ext];

    const headers: Record<string, string> = {
      "Cache-Control": "public, max-age=31536000, immutable",
      // Never let the browser sniff a different, executable content type.
      "X-Content-Type-Options": "nosniff",
    };

    if (inlineType) {
      headers["Content-Type"] = inlineType;
    } else {
      // Anything not on the inline allowlist (SVG, HTML, unknown) is forced to
      // download and sandboxed so it cannot execute in the app's origin.
      const filename = path.basename(filePath);
      headers["Content-Type"] = "application/octet-stream";
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
      headers["Content-Security-Policy"] = "sandbox";
    }

    return new NextResponse(buffer, { headers });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
