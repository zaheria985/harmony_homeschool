export type RecurrenceType = "once" | "weekly" | "biweekly" | "monthly";

export type ExternalEvent = {
  id: string;
  title: string;
  description: string | null;
  recurrence_type: RecurrenceType;
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

export type ExternalEventOccurrence = {
  event_id: string;
  date: string;
  title: string;
  description: string | null;
  color: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  children: { id: string; name: string }[];
};

export type ParsedDateImport = {
  dates: string[];
  recurrenceType: RecurrenceType;
  dayOfWeek: number | null;
  startDate: string;
  endDate: string | null;
  impliedExceptionDates: string[];
};
