import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { findBookCover, simplifyTitle } from "../lib/server/book-covers";

/**
 * Covers are fetched once, at creation, from OpenLibrary — so a path that
 * forgets the lookup leaves those books blank forever. Most of the live
 * library ended up cover-less exactly this way: `bulkImportBooks` never
 * looked one up.
 *
 * The source scan below is the guard against that regressing; the behavior
 * tests pin the two mistakes the old inline lookups made (taking the first
 * match even when it has no cover, and letting a bad author kill the search).
 */

const ROOT = path.join(__dirname, "..");

type FetchLike = typeof globalThis.fetch;

/** Swap in a fake fetch for one call and always restore the real one. */
async function withFetch<T>(fake: FetchLike, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

test("picks the first result that actually has a cover", async () => {
  const cover = await withFetch(
    (async () =>
      jsonResponse({
        docs: [{}, { cover_i: 0 }, { cover_i: 8231856 }],
      })) as FetchLike,
    () => findBookCover("Children Just Like Me", "Barnabas Kindersley"),
  );

  // The first two docs carry no usable cover id; the third does.
  assert.equal(cover, "https://covers.openlibrary.org/b/id/8231856-L.jpg");
});

test("retries on title alone when the author search finds no cover", async () => {
  const queries: string[] = [];
  const cover = await withFetch(
    (async (input: string | URL | Request) => {
      const url = String(input);
      queries.push(url);
      // First call carries the author and matches nothing usable.
      if (url.includes("author=")) return jsonResponse({ docs: [] });
      return jsonResponse({ docs: [{ cover_i: 42 }] });
    }) as FetchLike,
    () => findBookCover("A Thirst for Home", "Typo McWrongname"),
  );

  assert.equal(cover, "https://covers.openlibrary.org/b/id/42-L.jpg");
  assert.equal(queries.length, 2, "expected an author search then a title-only retry");
  assert.ok(!queries[1].includes("author="), "retry should drop the author");
});

test("asks for several matches, not just the top one", async () => {
  let requested = "";
  await withFetch(
    (async (input: string | URL | Request) => {
      requested = String(input);
      return jsonResponse({ docs: [{ cover_i: 1 }] });
    }) as FetchLike,
    () => findBookCover("Anything"),
  );

  const limit = new URL(requested).searchParams.get("limit");
  assert.ok(Number(limit) > 1, `limit should exceed 1, got ${limit}`);
});

test("falls back to the main title when the full one matches nothing", async () => {
  // Verified against the live API: "Brothers in Hope: The Story of the Lost
  // Boys of Sudan" returns nothing, "Brothers in Hope" returns covers. This
  // is why most of the backfill's misses were real, well-catalogued books.
  const tried: string[] = [];
  const cover = await withFetch(
    (async (input: string | URL | Request) => {
      const title = new URL(String(input)).searchParams.get("title") || "";
      tried.push(title);
      if (title.includes(":")) return jsonResponse({ docs: [] });
      return jsonResponse({ docs: [{ cover_i: 77 }] });
    }) as FetchLike,
    () =>
      findBookCover("Brothers in Hope: The Story of the Lost Boys of Sudan"),
  );

  assert.equal(cover, "https://covers.openlibrary.org/b/id/77-L.jpg");
  assert.ok(
    tried.includes("Brothers in Hope"),
    `expected a retry on the main title, tried: ${tried.join(" | ")}`,
  );
});

test("simplifyTitle strips subtitles and series notes", () => {
  assert.equal(
    simplifyTitle("Brothers in Hope: The Story of the Lost Boys of Sudan"),
    "Brothers in Hope",
  );
  assert.equal(
    simplifyTitle("Benin (Blastoff! Readers: Exploring Countries)"),
    "Benin",
  );
  // A title with nothing to strip is returned unchanged, so no extra request.
  assert.equal(simplifyTitle("The Cat in the Hat"), "The Cat in the Hat");
});

test("returns null instead of throwing when the lookup fails", async () => {
  const cover = await withFetch(
    (async () => {
      throw new Error("network is down");
    }) as FetchLike,
    () => findBookCover("Some Book", "Some Author"),
  );

  assert.equal(cover, null);
});

test("returns null for an empty title without calling out", async () => {
  let called = false;
  const cover = await withFetch(
    (async () => {
      called = true;
      return jsonResponse({ docs: [] });
    }) as FetchLike,
    () => findBookCover("   "),
  );

  assert.equal(cover, null);
  assert.equal(called, false, "an empty title should not reach the network");
});

test("every path that creates a book resource looks up a cover", () => {
  // Source scan: a new creation path that skips findBookCover is the exact
  // regression that produced the current cover-less library.
  const files = [
    ["lib", "actions", "resources.ts"],
    ["lib", "actions", "booklists.ts"],
    ["lib", "actions", "lessons.ts"],
  ];
  const problems: string[] = [];

  for (const segments of files) {
    const source = readFileSync(path.join(ROOT, ...segments), "utf8");
    const name = segments.join("/");

    // Every INSERT INTO resources, with enough of its VALUES clause to see
    // what the type column is actually fed.
    const inserts = [
      ...source.matchAll(/INSERT INTO resources\s*\(([^)]*)\)([\s\S]{0,160})/gi),
    ];
    for (const [, columns, values] of inserts) {
      if (/thumbnail_url/i.test(columns)) continue; // carries a looked-up cover

      // A statement that hardcodes some other type can never hold a book.
      const literalTypes = [...values.matchAll(/'(\w+)'/g)].map((m) => m[1]);
      const nonBookLiteral =
        literalTypes.length > 0 &&
        literalTypes.some((value) =>
          ["supply", "video", "pdf", "link", "local_file"].includes(value),
        );
      if (nonBookLiteral) continue;

      problems.push(
        `${name}: INSERT INTO resources (${columns.replace(/\s+/g, " ").trim()}) can store a book but no thumbnail_url`,
      );
    }

    if (/openlibrary\.org/i.test(source)) {
      problems.push(`${name}: calls OpenLibrary directly instead of findBookCover`);
    }
  }

  assert.deepEqual(problems, [], problems.join("\n"));
});
