import pool from "@/lib/db";
import { expandExternalEventOccurrences } from "@/lib/utils/recurrence";
import type { ExternalEvent, ExternalEventOccurrence } from "@/types/external-events";

type RawExternalEvent = {
  id: string;
  title: string;
  description: string | null;
  recurrence_type: "once" | "weekly" | "biweekly" | "monthly";
  day_of_week: number | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  color: string;
  location: string | null;
  travel_minutes: number | null;
  created_at: string;
  children: { id: string; name: string }[];
  exception_dates: string[];
};

function mapRow(row: RawExternalEvent): ExternalEvent {
  return {
    ...row,
    children: row.children || [],
    exception_dates: row.exception_dates || [],
  };
}

export async function getExternalEventsForAdmin(parentId?: string): Promise<ExternalEvent[]> {
  const params: string[] = [];
  const scopeSql = parentId
    ? `WHERE EXISTS (
         SELECT 1
         FROM external_event_children ec2
         JOIN parent_children pc ON pc.child_id = ec2.child_id
         WHERE ec2.external_event_id = e.id
           AND pc.parent_id = $1
       )`
    : "";
  if (parentId) params.push(parentId);

  const res = await pool.query(
    `SELECT
       e.id,
       e.title,
       e.description,
       e.recurrence_type,
       e.day_of_week,
       e.start_date::text,
       e.end_date::text,
       e.start_time::text,
       e.end_time::text,
       e.all_day,
       e.color,
       e.location,
       e.travel_minutes,
       e.created_at::text,
       COALESCE(
         json_agg(
           DISTINCT jsonb_build_object('id', c.id, 'name', c.name)
         ) FILTER (WHERE c.id IS NOT NULL),
         '[]'::json
       ) AS children,
       COALESCE(
         array_agg(DISTINCT ex.exception_date::text)
         FILTER (WHERE ex.exception_date IS NOT NULL),
         ARRAY[]::text[]
       ) AS exception_dates
     FROM external_events e
      LEFT JOIN external_event_children ec ON ec.external_event_id = e.id
      LEFT JOIN children c ON c.id = ec.child_id
      LEFT JOIN external_event_exceptions ex ON ex.external_event_id = e.id
      ${scopeSql}
      GROUP BY e.id
      ORDER BY e.start_date, e.title`,
    params
  );
  return (res.rows as RawExternalEvent[]).map(mapRow);
}

export async function getExternalEventOccurrencesForRange(
  rangeStart: string,
  rangeEnd: string,
  childId?: string,
  parentId?: string
): Promise<ExternalEventOccurrence[]> {
  const params: string[] = [rangeStart, rangeEnd];
  const scopeClauses: string[] = [];
  if (childId) {
    scopeClauses.push(
      `EXISTS (
        SELECT 1
        FROM external_event_children ec2
        WHERE ec2.external_event_id = e.id
          AND ec2.child_id = $${params.length + 1}
      )`
    );
    params.push(childId);
  }

  if (parentId) {
    scopeClauses.push(
      `EXISTS (
        SELECT 1
        FROM external_event_children ec3
        JOIN parent_children pc ON pc.child_id = ec3.child_id
        WHERE ec3.external_event_id = e.id
          AND pc.parent_id = $${params.length + 1}
      )`
    );
    params.push(parentId);
  }

  const scopeSql = scopeClauses.length > 0 ? `AND ${scopeClauses.join(" AND ")}` : "";

  const res = await pool.query(
    `SELECT
       e.id,
       e.title,
       e.description,
       e.recurrence_type,
       e.day_of_week,
       e.start_date::text,
       e.end_date::text,
       e.start_time::text,
       e.end_time::text,
       e.all_day,
       e.color,
       e.location,
       e.travel_minutes,
       e.created_at::text,
       COALESCE(
         json_agg(
           DISTINCT jsonb_build_object('id', c.id, 'name', c.name)
         ) FILTER (WHERE c.id IS NOT NULL),
         '[]'::json
       ) AS children,
       COALESCE(
         array_agg(DISTINCT ex.exception_date::text)
         FILTER (WHERE ex.exception_date IS NOT NULL),
         ARRAY[]::text[]
       ) AS exception_dates
     FROM external_events e
     LEFT JOIN external_event_children ec ON ec.external_event_id = e.id
     LEFT JOIN children c ON c.id = ec.child_id
     LEFT JOIN external_event_exceptions ex ON ex.external_event_id = e.id
      WHERE e.start_date <= $2::date
        AND (e.end_date IS NULL OR e.end_date >= $1::date)
        ${scopeSql}
      GROUP BY e.id
      ORDER BY e.start_date, e.title`,
    params
  );

  const events = (res.rows as RawExternalEvent[]).map(mapRow);
  return events
    .flatMap((event) => expandExternalEventOccurrences(event, rangeStart, rangeEnd))
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.title.localeCompare(b.title);
    });
}
