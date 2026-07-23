import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/authz";
import { search } from "@/lib/queries/search";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q") || "";

  // A kid only ever searches their own work; the scope is taken from the
  // session, never from the request.
  const childId = user.role === "kid" ? user.childId : null;
  if (user.role === "kid" && !childId) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await search(query, childId);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[search] query failed", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
