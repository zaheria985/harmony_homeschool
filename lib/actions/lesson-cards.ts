"use server";

import { z } from "zod";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

// ============================================================================
// YouTube helper
// ============================================================================

async function fetchYouTubeMeta(url: string) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      title: data.title as string,
      thumbnail_url: data.thumbnail_url as string,
    };
  } catch {
    return null;
  }
}

async function fetchOgMeta(url: string): Promise<{ title?: string; description?: string; image?: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HarmonyBot/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    const head = html.split("</head>")[0] || html.slice(0, 20000);
    const og = (prop: string) => {
      const match = head.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
        || head.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"));
      return match?.[1] || undefined;
    };
    const title = og("title") || head.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const description = og("description");
    const image = og("image");
    if (!title && !description && !image) return null;
    return { title, description, image };
  } catch {
    return null;
  }
}

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function detectCardType(url?: string | null, content?: string | null): string {
  if (url) {
    if (extractYouTubeId(url)) return "youtube";
    if (/\.(jpg|jpeg|png|gif|webp|svg|avif)(\?|$)/i.test(url)) return "image";
    return "url";
  }
  if (content && /^- \[[ x]\]/m.test(content)) return "checklist";
  return "note";
}

// ============================================================================
// Schemas
// ============================================================================

const createLessonCardSchema = z.object({
  lesson_id: z.string().uuid(),
  card_type: z.enum(["checklist", "youtube", "url", "resource", "note", "image"]).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  resource_id: z.string().uuid().optional(),
});

const updateLessonCardSchema = z.object({
  id: z.string().uuid(),
  card_type: z.enum(["checklist", "youtube", "url", "resource", "note", "image"]).optional(),
  title: z.string().optional(),
  content: z.string().optional(),
  url: z.string().optional(),
  resource_id: z.string().uuid().nullable().optional(),
});

// ============================================================================
// Actions
// ============================================================================

export async function createLessonCard(formData: FormData) {
  const data = createLessonCardSchema.safeParse({
    lesson_id: formData.get("lesson_id"),
    card_type: formData.get("card_type") || undefined,
    title: formData.get("title") || undefined,
    content: formData.get("content") || undefined,
    url: formData.get("url") || undefined,
    resource_id: formData.get("resource_id") || undefined,
  });

  if (!data.success) return { error: data.error.issues[0]?.message || "Invalid data" };

  const { lesson_id, title, content, url, resource_id } = data.data;
  let card_type = data.data.card_type;

  // Auto-detect card type if not specified
  if (!card_type) {
    if (resource_id) {
      card_type = "resource";
    } else {
      card_type = detectCardType(url, content) as "checklist" | "youtube" | "url" | "resource" | "note" | "image";
    }
  }

  // Fetch YouTube metadata if applicable
  let thumbnailUrl: string | null = null;
  let finalTitle = title || null;
  if (card_type === "youtube" && url) {
    const meta = await fetchYouTubeMeta(url);
    if (meta) {
      thumbnailUrl = meta.thumbnail_url;
      if (!finalTitle) finalTitle = meta.title;
    } else {
      const ytId = extractYouTubeId(url);
      if (ytId) thumbnailUrl = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
    }
  }

  // Fetch OG metadata for URL cards
  let ogTitle: string | null = null;
  let ogDescription: string | null = null;
  let ogImage: string | null = null;
  if ((card_type === "url" || card_type === "image") && url) {
    const og = await fetchOgMeta(url);
    if (og) {
      ogTitle = og.title || null;
      ogDescription = og.description || null;
      ogImage = og.image || null;
      if (!finalTitle && ogTitle) finalTitle = ogTitle;
    }
  }

  // Get next order_index
  const orderRes = await pool.query(
    `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM lesson_cards WHERE lesson_id = $1`,
    [lesson_id]
  );

  const res = await pool.query(
    `INSERT INTO lesson_cards (lesson_id, card_type, title, content, url, thumbnail_url, og_title, og_description, og_image, resource_id, order_index)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [lesson_id, card_type, finalTitle, content || null, url || null, thumbnailUrl, ogTitle, ogDescription, ogImage, resource_id || null, orderRes.rows[0].next_idx]
  );

  // Find curriculum_id for revalidation
  const lessonRes = await pool.query(`SELECT curriculum_id FROM lessons WHERE id = $1`, [lesson_id]);
  if (lessonRes.rows[0]) {
    revalidatePath(`/curricula/${lessonRes.rows[0].curriculum_id}/board`);
  }
  revalidatePath(`/lessons/${lesson_id}`);

  return { success: true, id: res.rows[0].id };
}

export async function updateLessonCard(formData: FormData) {
  const data = updateLessonCardSchema.safeParse({
    id: formData.get("id"),
    card_type: formData.get("card_type") || undefined,
    title: formData.get("title") || undefined,
    content: formData.get("content") || undefined,
    url: formData.get("url") || undefined,
    resource_id: formData.get("resource_id") === "" ? null : formData.get("resource_id") || undefined,
  });

  if (!data.success) return { error: data.error.issues[0]?.message || "Invalid data" };

  const { id, card_type, title, content, url, resource_id } = data.data;

  const sets: string[] = [];
  const params: (string | null)[] = [];
  let idx = 1;

  if (card_type !== undefined) { sets.push(`card_type = $${idx++}`); params.push(card_type); }
  if (title !== undefined) { sets.push(`title = $${idx++}`); params.push(title); }
  if (content !== undefined) { sets.push(`content = $${idx++}`); params.push(content); }
  if (url !== undefined) {
    sets.push(`url = $${idx++}`);
    params.push(url);
    // Re-detect thumbnail
    if (extractYouTubeId(url)) {
      const meta = await fetchYouTubeMeta(url);
      sets.push(`thumbnail_url = $${idx++}`);
      params.push(meta?.thumbnail_url || `https://img.youtube.com/vi/${extractYouTubeId(url)}/mqdefault.jpg`);
    }
    if (!extractYouTubeId(url)) {
      const og = await fetchOgMeta(url);
      if (og) {
        sets.push(`og_title = $${idx++}`); params.push(og.title || null);
        sets.push(`og_description = $${idx++}`); params.push(og.description || null);
        sets.push(`og_image = $${idx++}`); params.push(og.image || null);
      }
    }
  }
  if (resource_id !== undefined) { sets.push(`resource_id = $${idx++}`); params.push(resource_id); }

  if (sets.length === 0) return { error: "No fields to update" };

  params.push(id);
  await pool.query(`UPDATE lesson_cards SET ${sets.join(", ")} WHERE id = $${idx}`, params);

  // Revalidate
  const cardRes = await pool.query(
    `SELECT l.curriculum_id, lc.lesson_id FROM lesson_cards lc JOIN lessons l ON l.id = lc.lesson_id WHERE lc.id = $1`,
    [id]
  );
  if (cardRes.rows[0]) {
    revalidatePath(`/curricula/${cardRes.rows[0].curriculum_id}/board`);
    revalidatePath(`/lessons/${cardRes.rows[0].lesson_id}`);
  }

  return { success: true };
}

export async function deleteLessonCard(id: string) {
  // Get lesson info before delete for revalidation
  const cardRes = await pool.query(
    `SELECT l.curriculum_id, lc.lesson_id FROM lesson_cards lc JOIN lessons l ON l.id = lc.lesson_id WHERE lc.id = $1`,
    [id]
  );

  await pool.query(`DELETE FROM lesson_cards WHERE id = $1`, [id]);

  if (cardRes.rows[0]) {
    revalidatePath(`/curricula/${cardRes.rows[0].curriculum_id}/board`);
    revalidatePath(`/lessons/${cardRes.rows[0].lesson_id}`);
  }

  return { success: true };
}

export async function reorderLessonCards(updates: { id: string; order_index: number }[]) {
  if (updates.length === 0) return { success: true };
  if (updates.length > 500) return { error: "Too many cards to reorder at once" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const u of updates) {
      await client.query(`UPDATE lesson_cards SET order_index = $1 WHERE id = $2`, [u.order_index, u.id]);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  return { success: true };
}

export async function bulkCreateLessonCards(
  items: Array<{
    lessonId: string;
    cards: Array<{
      card_type: "checklist" | "youtube" | "url" | "resource" | "note" | "image";
      title?: string;
      content?: string;
      url?: string;
      thumbnail_url?: string;
    }>;
  }>
) {
  if (items.length === 0) return { success: true, created: 0 };

  const client = await pool.connect();
  let totalCreated = 0;

  try {
    await client.query("BEGIN");

    for (const item of items) {
      for (let i = 0; i < item.cards.length; i++) {
        const card = item.cards[i];

        let thumbnailUrl = card.thumbnail_url || null;
        let finalTitle = card.title || null;
        if (card.card_type === "youtube" && card.url) {
          const meta = await fetchYouTubeMeta(card.url);
          if (meta) {
            thumbnailUrl = thumbnailUrl || meta.thumbnail_url;
            finalTitle = finalTitle || meta.title;
          }
          if (!thumbnailUrl) {
            const ytId = extractYouTubeId(card.url);
            if (ytId) thumbnailUrl = `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
          }
        }

        let ogTitle: string | null = null;
        let ogDescription: string | null = null;
        let ogImage: string | null = null;
        if ((card.card_type === "url" || card.card_type === "image") && card.url) {
          const og = await fetchOgMeta(card.url);
          if (og) {
            ogTitle = og.title || null;
            ogDescription = og.description || null;
            ogImage = og.image || null;
            if (!finalTitle && ogTitle) finalTitle = ogTitle;
          }
        }

        await client.query(
          `INSERT INTO lesson_cards (lesson_id, card_type, title, content, url, thumbnail_url, og_title, og_description, og_image, order_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [item.lessonId, card.card_type, finalTitle, card.content || null, card.url || null, thumbnailUrl, ogTitle, ogDescription, ogImage, i]
        );
        totalCreated++;
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    return { error: err instanceof Error ? err.message : "Failed to create lesson cards" };
  } finally {
    client.release();
  }

  return { success: true, created: totalCreated };
}
