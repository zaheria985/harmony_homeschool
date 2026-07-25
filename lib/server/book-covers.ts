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
 * Google Books, tried only when OpenLibrary has nothing.
 *
 * Needs `GOOGLE_BOOKS_API_KEY`: keyless requests all share one exhausted
 * daily quota and come back 429, so without a key this step is skipped and
 * the lookup behaves exactly as it did before.
 *
 * The query is deliberately `intitle:` rather than a bare search. A loose
 * search is worse than no cover — OpenLibrary's general search answers
 * "Animals of the Sahara" with the cover of "Le petit prince", and a wrong
 * cover silently attached is harder to notice than a missing one.
 */
async function googleBooksCover(
  title: string,
  author: string,
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) return null;

  const query = author
    ? `intitle:${title} inauthor:${author}`
    : `intitle:${title}`;
  const params = new URLSearchParams({
    q: query,
    maxResults: "5",
    printType: "books",
    key: apiKey,
  });

  const response = await fetch(
    `https://www.googleapis.com/books/v1/volumes?${params}`,
    { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
  );
  if (!response.ok) {
    console.warn("[book-covers] google books returned", response.status);
    return null;
  }

  const data = (await response.json()) as {
    items?: Array<{ volumeInfo?: { imageLinks?: { thumbnail?: string } } }>;
  };
  const thumbnail = (data.items || [])
    .map((item) => item.volumeInfo?.imageLinks?.thumbnail)
    .find(Boolean);
  if (!thumbnail) return null;

  // Google hands back http with a decorative page-curl; neither is wanted on
  // a page served over https.
  return thumbnail.replace(/^http:/, "https:").replace(/&edge=curl/, "");
}

export type CoverSource = "openlibrary" | "google";
export type CoverResult = { url: string; source: CoverSource };

/**
 * Best-effort cover for a book, with the source that supplied it. Returns
 * null when nothing matches, a request fails, or the title is empty — never
 * throws.
 */
export async function findBookCoverDetailed(
  title: string,
  author?: string | null,
): Promise<CoverResult | null> {
  const cleanTitle = (title || "").trim();
  if (!cleanTitle) return null;
  const cleanAuthor = (author || "").trim();

  try {
    for (const params of searchVariants(cleanTitle, cleanAuthor)) {
      const found = await searchForCover(params);
      if (found) return { url: found, source: "openlibrary" };
    }

    const fromGoogle = await googleBooksCover(cleanTitle, cleanAuthor);
    if (fromGoogle) return { url: fromGoogle, source: "google" };

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

/** Cover URL only — what every creation path needs. */
export async function findBookCover(
  title: string,
  author?: string | null,
): Promise<string | null> {
  const result = await findBookCoverDetailed(title, author);
  return result?.url ?? null;
}

/** Politeness delay between backfill requests — OpenLibrary asks for ~1/sec. */
export const COVER_LOOKUP_DELAY_MS = 1000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
