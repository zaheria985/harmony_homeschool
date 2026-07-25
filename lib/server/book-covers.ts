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
 * The main title, without the parts catalogues usually leave off.
 *
 * Homeschool booklists record a book the way its cover reads — "Brothers in
 * Hope: The Story of the Lost Boys of Sudan", "Benin (Blastoff! Readers:
 * Exploring Countries)" — while OpenLibrary indexes it as "Brothers in Hope".
 * Searching the full string matches nothing at all, so a subtitle or a series
 * name in parentheses silently costs the book its cover.
 */
export function simplifyTitle(title: string): string {
  return title
    .replace(/\([^)]*\)/g, " ") // series and edition notes
    .replace(/\s*[:—–]\s.*$/, "") // subtitle after a colon or dash
    .replace(/\s+/g, " ")
    .trim();
}

/** Search variants to try in order, stopping at the first that has a cover. */
function searchVariants(title: string, author: string): URLSearchParams[] {
  const simplified = simplifyTitle(title);
  const titles = simplified && simplified !== title ? [title, simplified] : [title];

  const variants: URLSearchParams[] = [];
  for (const withAuthor of author ? [true, false] : [false]) {
    for (const candidate of titles) {
      const params = new URLSearchParams({
        title: candidate,
        limit: String(SEARCH_LIMIT),
      });
      if (withAuthor) params.set("author", author);
      variants.push(params);
    }
  }
  return variants;
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
    for (const params of searchVariants(cleanTitle, cleanAuthor)) {
      const found = await searchForCover(params);
      if (found) return found;
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
