import type { ExternalEvent, ExternalEventOccurrence, ParsedDateImport, RecurrenceType } from "@/types/external-events";

function toDateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function toDateStr(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseFlexibleDate(input: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const [m, d, y] = trimmed.split("/").map(Number);
    return new Date(y, m - 1, d);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateOnly(parsed);
}

function diffDays(a: Date, b: Date): number {
  const ms = toDateOnly(b).getTime() - toDateOnly(a).getTime();
  return Math.round(ms / 86400000);
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return toDateOnly(next);
}

function addMonths(base: Date, count: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + count);
  return toDateOnly(next);
}

export function parseImportedDates(raw: string): ParsedDateImport | { error: string } {
  const parsed = raw
    .split(/\r?\n/)
    .map((line) => parseFlexibleDate(line))
    .filter((date): date is Date => Boolean(date));

  if (parsed.length === 0) {
    return { error: "Paste at least one valid date" };
  }

  const unique = Array.from(new Set(parsed.map((date) => toDateStr(date))))
    .map((value) => new Date(`${value}T00:00:00`))
    .sort((a, b) => a.getTime() - b.getTime());

  const startDate = unique[0];
  const endDate = unique[unique.length - 1];
  const dateStrings = unique.map((date) => toDateStr(date));

  if (unique.length === 1) {
    return {
      dates: dateStrings,
      recurrenceType: "once",
      dayOfWeek: startDate.getDay(),
      startDate: toDateStr(startDate),
      endDate: null,
      impliedExceptionDates: [],
    };
  }

  const weekdays = new Set(unique.map((date) => date.getDay()));
  const diffs = unique.slice(1).map((date, index) => diffDays(unique[index], date));

  let recurrenceType: RecurrenceType = "once";
  if (weekdays.size === 1 && diffs.every((gap) => gap % 14 === 0)) {
    recurrenceType = "biweekly";
  } else if (weekdays.size === 1 && diffs.every((gap) => gap % 7 === 0)) {
    recurrenceType = "weekly";
  } else {
    const dayOfMonth = startDate.getDate();
    const monthly = unique.every((date) => date.getDate() === dayOfMonth);
    recurrenceType = monthly ? "monthly" : "weekly";
  }

  const dayOfWeek = recurrenceType === "monthly" ? null : startDate.getDay();
  const expected = new Set<string>();
  if (recurrenceType === "weekly" || recurrenceType === "biweekly") {
    const step = recurrenceType === "weekly" ? 7 : 14;
    let cursor = toDateOnly(startDate);
    while (cursor <= endDate) {
      expected.add(toDateStr(cursor));
      cursor = addDays(cursor, step);
    }
  } else if (recurrenceType === "monthly") {
    let cursor = toDateOnly(startDate);
    while (cursor <= endDate) {
      expected.add(toDateStr(cursor));
      cursor = addMonths(cursor, 1);
    }
  }

  const actual = new Set(dateStrings);
  const impliedExceptionDates = Array.from(expected).filter((date) => !actual.has(date));

  return {
    dates: dateStrings,
    recurrenceType,
    dayOfWeek,
    startDate: toDateStr(startDate),
    endDate: toDateStr(endDate),
    impliedExceptionDates,
  };
}

export function expandExternalEventOccurrences(
  event: Pick<ExternalEvent, "id" | "title" | "description" | "recurrence_type" | "day_of_week" | "start_date" | "end_date" | "start_time" | "end_time" | "all_day" | "color" | "children" | "exception_dates">,
  rangeStart: string,
  rangeEnd: string
): ExternalEventOccurrence[] {
  const start = new Date(`${event.start_date}T00:00:00`);
  const hardEnd = event.end_date ? new Date(`${event.end_date}T00:00:00`) : new Date(`${rangeEnd}T00:00:00`);
  const from = new Date(`${rangeStart}T00:00:00`);
  const to = new Date(`${rangeEnd}T00:00:00`);
  const exceptions = new Set(event.exception_dates || []);

  const result: ExternalEventOccurrence[] = [];

  if (event.recurrence_type === "once") {
    const dateStr = toDateStr(start);
    if (start >= from && start <= to && !exceptions.has(dateStr)) {
      result.push({
        event_id: event.id,
        date: dateStr,
        title: event.title,
        description: event.description,
        color: event.color,
        start_time: event.start_time,
        end_time: event.end_time,
        all_day: event.all_day,
        children: event.children,
      });
    }
    return result;
  }

  let cursor = toDateOnly(start);
  const stepDays = event.recurrence_type === "biweekly" ? 14 : event.recurrence_type === "weekly" ? 7 : 0;

  if (event.recurrence_type === "weekly" || event.recurrence_type === "biweekly") {
    while (cursor <= hardEnd) {
      if (cursor >= from && cursor <= to) {
        const dateStr = toDateStr(cursor);
        if (!exceptions.has(dateStr)) {
          result.push({
            event_id: event.id,
            date: dateStr,
            title: event.title,
            description: event.description,
            color: event.color,
            start_time: event.start_time,
            end_time: event.end_time,
            all_day: event.all_day,
            children: event.children,
          });
        }
      }
      cursor = addDays(cursor, stepDays);
    }
    return result;
  }

  while (cursor <= hardEnd) {
    if (cursor >= from && cursor <= to) {
      const dateStr = toDateStr(cursor);
      if (!exceptions.has(dateStr)) {
        result.push({
          event_id: event.id,
          date: dateStr,
          title: event.title,
          description: event.description,
          color: event.color,
          start_time: event.start_time,
          end_time: event.end_time,
          all_day: event.all_day,
          children: event.children,
        });
      }
    }
    cursor = addMonths(cursor, 1);
  }

  return result;
}

export function formatTimeRange(startTime: string | null, endTime: string | null, allDay: boolean): string {
  if (allDay) return "All day";
  if (!startTime && !endTime) return "";
  const format = (time: string) => {
    const [hourRaw, minute] = time.split(":");
    const hour = Number(hourRaw);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
  };

  if (startTime && endTime) return `${format(startTime)} - ${format(endTime)}`;
  if (startTime) return `Starts ${format(startTime)}`;
  return `Until ${format(endTime as string)}`;
}
