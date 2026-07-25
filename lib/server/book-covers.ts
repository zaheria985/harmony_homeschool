/**
 * Book cover lookup against OpenLibrary.
 *
 * Every path that creates a book resource funnels through `findBookCover` so
 * covers behave the same no matter which door the book came in through — the
 * old copy-pasted lookups only lived on three of six creation paths, which is
 * why so much of the library ended up cover-less.
 *
 * Two rules the previous inline versions got wrong:
 *   - ask for several matches and take the first one that actually *has* a
 *     cover, rather than taking the single top match and giving up when it
 *     has none;
 *   - when an author was supplied and nothing matched, retry on title alone —
 *     a misspelled or differently-formatted author should not cost the cover.
 *
 * Lookups are always best-effort: a failure returns null and is logged. No
 * caller may block or fail a save on a missing cover.
 */

const SEARCH_ENDPOINT = "https://openlibrary.org/search.json";
const SEARCH_LIMIT = 5;
const REQUEST_TIMEOUT_MS = 8000;

type OpenLibraryDoc = { cover_i?: number };
type OpenLibraryResponse = { docs?: OpenLibraryDoc[] };

export function coverUrlForId(coverId: number): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
}

async function searchForCover(
  params: URLSearchParams,
): Promise<string | null> {
  const url = `${SEARCH_ENDPOINT}?${params}`;
  const response = await fetch(url, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { "User-Agent": "HarmonyHomeschool/1.0 (self-hosted)" },
  });
  if (!response.ok) {
    console.warn("[book-covers] lookup returned", response.status, url);
    return null;
  }

  const data = (await response.json()) as OpenLibraryResponse;
  const docs = data.docs || [];
  // The top match is often an edition with no scanned cover while the next
  // one has a perfectly good one. Ids are positive; 0 is a placeholder that
  // resolves to a blank image, so it does not count as a cover.
  const withCover = docs.find(
    (doc) => typeof doc.cover_i === "number" && doc.cover_i > 0,
  );
  return withCover ? coverUrlForId(withCover.cover_i as number) : null;
}

/**
 * Best-effort cover URL for a book. Returns null when nothing matches, the
 * request fails, or the title is empty — never throws.
 */
export async function findBookCover(
  title: string,
  author?: string | null,
): Promise<string | null> {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return null;
  const cleanAuthor = (author || "").trim();

  try {
    const params = new URLSearchParams({
      title: cleanTitle,
      limit: String(SEARCH_LIMIT),
    });
    if (cleanAuthor) params.set("author", cleanAuthor);

    const found = await searchForCover(params);
    if (found) return found;

    // The author narrowed us to nothing usable; the title alone may still hit.
    if (cleanAuthor) {
      const titleOnly = new URLSearchParams({
        title: cleanTitle,
        limit: String(SEARCH_LIMIT),
      });
      const retry = await searchForCover(titleOnly);
      if (retry) return retry;
    }

    console.log("[book-covers] no cover found", { title: cleanTitle, author: cleanAuthor });
    return null;
  } catch (err) {
    console.warn("[book-covers] lookup failed", {
      title: cleanTitle,
      author: cleanAuthor,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Politeness delay between backfill requests — OpenLibrary asks for ~1/sec. */
export const COVER_LOOKUP_DELAY_MS = 1000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
