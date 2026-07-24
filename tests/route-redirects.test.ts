import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Pages the redesign retired still have to answer, because they are bookmarked,
 * linked from old digests, and baked into the installed PWA's start_url.
 *
 * Each retired route keeps a page that redirects rather than 404s, and nothing
 * in the app links to the old path any more — a redirect that everything still
 * points at is a redirect that runs on every navigation.
 */

const ROOT = path.join(__dirname, "..");

const RETIRED: Array<{ route: string; target: string }> = [
  { route: "app/dashboard/page.tsx", target: "/today" },
  { route: "app/prep/page.tsx", target: "/week" },
  { route: "app/grades/page.tsx", target: "/students" },
];

test("retired routes redirect instead of 404ing", () => {
  for (const { route, target } of RETIRED) {
    const file = path.join(ROOT, route);
    assert.ok(existsSync(file), `${route} is missing`);
    const source = readFileSync(file, "utf8");
    assert.match(
      source,
      /redirect\(/,
      `${route} should call redirect()`,
    );
    assert.match(
      source,
      new RegExp(`redirect\\("${target}"\\)`),
      `${route} should redirect to ${target}`,
    );
  }
});

test("the kid path allowlist covers the routes kid navigation links to", () => {
  const middleware = readFileSync(path.join(ROOT, "middleware.ts"), "utf8");
  const tabs = readFileSync(
    path.join(ROOT, "components", "ui", "BottomTabs.tsx"),
    "utf8",
  );

  // Every href in the kidTabs array must be a path the middleware lets a kid
  // reach, or the tab bounces them straight back to /today.
  const kidTabsBlock = tabs.slice(
    tabs.indexOf("const kidTabs"),
    tabs.indexOf("function isActive"),
  );
  const hrefs = [...kidTabsBlock.matchAll(/href:\s*"([^"]+)"/g)].map(
    (match) => match[1],
  );

  assert.ok(hrefs.length >= 4, "expected the four kid tabs");
  for (const href of hrefs) {
    assert.ok(
      middleware.includes(`"${href}"`),
      `middleware does not allow kids on ${href}`,
    );
  }
});

test("the kid redirect target is itself a kid-allowed path", () => {
  const middleware = readFileSync(path.join(ROOT, "middleware.ts"), "utf8");
  const match = middleware.match(
    /NextResponse\.redirect\(new URL\("([^"]+)"/,
  );
  assert.ok(match, "expected a kid redirect target");
  const target = match![1];
  const allowlist = middleware.slice(
    middleware.indexOf("kidAllowedExactPaths"),
    middleware.indexOf("kidAllowedPrefixes"),
  );
  assert.ok(
    allowlist.includes(`"${target}"`),
    `${target} is the kid redirect target but is not allowlisted — kids would loop`,
  );
});
