// Types

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  closed: boolean;
  url: string;
}

export interface TrelloList {
  id: string;
  name: string;
  pos: number;
  closed: boolean;
}

export interface TrelloAttachment {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
}

export interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  pos: number;
  closed: boolean;
  idList: string;
  labels: TrelloLabel[];
  attachments: TrelloAttachment[];
}

// Helpers

export function isTrelloConfigured(): boolean {
  return (process.env.TRELLO_API_KEY || "").length > 0 && (process.env.TRELLO_TOKEN || "").length > 0;
}

async function trelloFetch<T>(path: string): Promise<T> {
  const key = process.env.TRELLO_API_KEY || "";
  const token = process.env.TRELLO_TOKEN || "";
  const separator = path.includes("?") ? "&" : "?";
  const url = `https://api.trello.com${path}${separator}key=${key}&token=${token}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Trello API GET ${path} failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<T>;
}

// API functions

export async function getBoards(): Promise<TrelloBoard[]> {
  const boards = await trelloFetch<TrelloBoard[]>(
    "/1/members/me/boards?filter=open&fields=name,desc,closed,url"
  );
  return boards.filter((b) => !b.closed);
}

export async function getBoardLists(boardId: string): Promise<TrelloList[]> {
  const lists = await trelloFetch<TrelloList[]>(
    `/1/boards/${boardId}/lists?filter=open`
  );
  return lists.filter((l) => !l.closed).sort((a, b) => a.pos - b.pos);
}

export async function getBoardCards(boardId: string): Promise<TrelloCard[]> {
  const cards = await trelloFetch<TrelloCard[]>(
    `/1/boards/${boardId}/cards?fields=name,desc,due,dueComplete,pos,closed,idList,labels&attachments=true`
  );
  return cards.filter((c) => !c.closed);
}
