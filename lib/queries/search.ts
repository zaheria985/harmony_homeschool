import pool from "@/lib/db";

export type SearchResult = {
  type: "lesson" | "curriculum" | "subject" | "resource" | "booklist";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const PER_TYPE_LIMIT = 6;

/**
 * Cross-entity search over lessons, curricula, subjects, resources, and
 * booklists.
 *
 * `childId` scopes the lesson and curriculum results to one student — pass the
 * kid's own child_id for a kid session so they cannot discover a sibling's
 * work. Subjects, resources, and booklists are shared library content and are
 * not scoped.
 */
export async function search(
  query: string,
  childId?: string | null,
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // Escape LIKE wildcards so a literal % or _ does not match everything.
  const pattern = `%${trimmed.replace(/([%_\\])/g, "\\$1")}%`;
  const scope = childId ?? null;

  const res = await pool.query(
    `
    (
      SELECT 'lesson' AS type, l.id::text, l.title,
             cu.name AS subtitle, l.planned_date
      FROM lessons l
      JOIN curricula cu ON cu.id = l.curriculum_id
      WHERE l.title ILIKE $1 ESCAPE '\\'
        AND l.archived = false
        AND (
          $2::uuid IS NULL
          OR EXISTS (
            SELECT 1 FROM curriculum_assignments ca
            WHERE ca.curriculum_id = cu.id AND ca.child_id = $2::uuid
          )
        )
      ORDER BY l.planned_date DESC NULLS LAST
      LIMIT $3
    )
    UNION ALL
    (
      SELECT 'curriculum' AS type, cu.id::text, cu.name AS title,
             s.name AS subtitle, NULL::date
      FROM curricula cu
      LEFT JOIN subjects s ON s.id = cu.subject_id
      WHERE cu.name ILIKE $1 ESCAPE '\\'
        AND (
          $2::uuid IS NULL
          OR EXISTS (
            SELECT 1 FROM curriculum_assignments ca
            WHERE ca.curriculum_id = cu.id AND ca.child_id = $2::uuid
          )
        )
      ORDER BY cu.name
      LIMIT $3
    )
    UNION ALL
    (
      SELECT 'subject' AS type, s.id::text, s.name AS title,
             NULL AS subtitle, NULL::date
      FROM subjects s
      WHERE s.name ILIKE $1 ESCAPE '\\'
      ORDER BY s.name
      LIMIT $3
    )
    UNION ALL
    (
      SELECT 'resource' AS type, r.id::text, r.title,
             r.author AS subtitle, NULL::date
      FROM resources r
      WHERE (r.title ILIKE $1 ESCAPE '\\' OR r.author ILIKE $1 ESCAPE '\\')
      ORDER BY r.title
      LIMIT $3
    )
    UNION ALL
    (
      SELECT 'booklist' AS type, b.id::text, b.name AS title,
             NULL AS subtitle, NULL::date
      FROM booklists b
      WHERE b.name ILIKE $1 ESCAPE '\\'
      ORDER BY b.name
      LIMIT $3
    )
    `,
    [pattern, scope, PER_TYPE_LIMIT],
  );

  const hrefFor = (type: string, id: string): string => {
    switch (type) {
      case "lesson":
        return `/lessons/${id}`;
      case "curriculum":
        return `/curricula/${id}`;
      case "subject":
        return `/subjects/${id}`;
      case "resource":
        return `/resources/${id}`;
      case "booklist":
        return `/booklists?list=${id}`;
      default:
        return "/dashboard";
    }
  };

  return (res.rows as {
    type: SearchResult["type"];
    id: string;
    title: string;
    subtitle: string | null;
  }[]).map((row) => ({
    type: row.type,
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    href: hrefFor(row.type, row.id),
  }));
}
