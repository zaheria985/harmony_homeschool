import {
  NextRequest,
  NextResponse,
} from "next/server"; /** * GET /api/resources/youtube * * Query params: * - url: string (required) * * Responses: * - 200: { title, thumbnail_url, author_name } * - 400: { error } * - 500: { error } */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") || "";
  if (!url) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: controller.signal },
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to fetch metadata" },
        { status: 400 },
      );
    }
    const data = (await response.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };
    return NextResponse.json({
      title: data.title || "",
      thumbnail_url: data.thumbnail_url || "",
      author_name: data.author_name || "",
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error && err.name === "AbortError"
            ? "Metadata lookup timed out"
            : "Lookup failed",
      },
      { status: 500 },
    );
  } finally {
    clearTimeout(timeout);
  }
}
