import { NextResponse } from "next/server";
import {
  isTrelloConfigured,
  getBoards,
  getBoardLists,
  getBoardCards,
} from "@/lib/trello";

export async function GET(request: Request) {
  if (!isTrelloConfigured()) {
    return NextResponse.json(
      { error: "Trello is not configured. Set TRELLO_API_KEY and TRELLO_TOKEN." },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  try {
    if (action === "boards") {
      const boards = await getBoards();
      return NextResponse.json({ boards });
    }

    if (action === "board-details") {
      const boardId = searchParams.get("boardId");
      if (!boardId) {
        return NextResponse.json({ error: "boardId is required" }, { status: 400 });
      }
      const [lists, cards] = await Promise.all([
        getBoardLists(boardId),
        getBoardCards(boardId),
      ]);
      return NextResponse.json({ lists, cards });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Trello API error", {
      action,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Failed to fetch from Trello" },
      { status: 502 }
    );
  }
}
