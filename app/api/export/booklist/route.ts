import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") || "html";
  const listId = req.nextUrl.searchParams.get("list") || "";

  // Get all booklists with their books
  const listsQuery = listId
    ? await pool.query(
        `SELECT id, name, description FROM booklists WHERE id = $1 ORDER BY name`,
        [listId]
      )
    : await pool.query(`SELECT id, name, description FROM booklists ORDER BY name`);

  const lists = listsQuery.rows;

  if (lists.length === 0) {
    return NextResponse.json({ error: "No booklists found" }, { status: 404 });
  }

  const listIds = lists.map((l: { id: string }) => l.id);

  const booksQuery = await pool.query(
    `SELECT
       br.booklist_id,
       r.title,
       r.author,
       c.name AS child_name
     FROM booklist_resources br
     JOIN resources r ON r.id = br.resource_id
     LEFT JOIN booklists bl ON bl.id = br.booklist_id
     LEFT JOIN children c ON c.id = bl.owner_child_id
     WHERE br.booklist_id = ANY($1)
     ORDER BY br.booklist_id, br.position, r.title`,
    [listIds]
  );

  // Group books by list
  const booksByList = new Map<string, typeof booksQuery.rows>();
  for (const row of booksQuery.rows) {
    const list = booksByList.get(row.booklist_id) || [];
    list.push(row);
    booksByList.set(row.booklist_id, list);
  }

  if (format === "txt") {
    let text = "BOOKLIST EXPORT\n";
    text += "=" .repeat(50) + "\n\n";

    for (const list of lists) {
      text += `${list.name}\n`;
      if (list.description) text += `${list.description}\n`;
      text += "-".repeat(40) + "\n";

      const books = booksByList.get(list.id) || [];
      if (books.length === 0) {
        text += "  (no books)\n";
      } else {
        for (let i = 0; i < books.length; i++) {
          const b = books[i];
          text += `  ${i + 1}. ${b.title}`;
          if (b.author) text += ` — ${b.author}`;
          text += "\n";
        }
      }
      text += "\n";
    }

    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": "attachment; filename=booklist.txt",
      },
    });
  }

  // HTML format — printable page
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Booklist</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a; padding: 2rem; max-width: 800px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 1.5rem; border-bottom: 2px solid #333; padding-bottom: 0.5rem; }
    .list { margin-bottom: 2rem; }
    .list-name { font-size: 1.25rem; font-weight: bold; margin-bottom: 0.25rem; }
    .list-desc { font-size: 0.875rem; color: #666; margin-bottom: 0.75rem; font-style: italic; }
    .books { list-style: none; }
    .books li { padding: 0.35rem 0; border-bottom: 1px dotted #ccc; display: flex; justify-content: space-between; }
    .book-title { font-weight: 500; }
    .book-author { color: #555; font-style: italic; }
    .empty { color: #999; font-style: italic; padding: 0.5rem 0; }
    .print-info { font-size: 0.75rem; color: #999; margin-top: 2rem; text-align: center; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom:1rem">
    <button onclick="window.print()" style="padding:0.5rem 1rem;cursor:pointer;background:#4f46e5;color:white;border:none;border-radius:6px;font-size:0.875rem">
      Print This Page
    </button>
    <a href="?format=txt${listId ? `&list=${listId}` : ""}" style="margin-left:0.5rem;padding:0.5rem 1rem;text-decoration:none;color:#4f46e5;font-size:0.875rem">
      Download as Text
    </a>
  </div>
  <h1>Booklist</h1>
  ${lists
    .map((list: { id: string; name: string; description: string | null }) => {
      const books = booksByList.get(list.id) || [];
      return `<div class="list">
    <div class="list-name">${escapeHtml(list.name)}</div>
    ${list.description ? `<div class="list-desc">${escapeHtml(list.description)}</div>` : ""}
    ${
      books.length === 0
        ? '<p class="empty">No books in this list.</p>'
        : `<ol class="books">${books
            .map(
              (b: { title: string; author: string | null }) =>
                `<li><span class="book-title">${escapeHtml(b.title)}</span>${b.author ? `<span class="book-author">${escapeHtml(b.author)}</span>` : ""}</li>`
            )
            .join("")}</ol>`
    }
  </div>`;
    })
    .join("\n")}
  <p class="print-info">Exported from Harmony Homeschool on ${new Date().toLocaleDateString()}</p>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
