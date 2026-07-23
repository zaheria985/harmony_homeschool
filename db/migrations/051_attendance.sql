-- Attendance and instructional-hours tracking for state reporting.
--
-- Attendance is *derived* by default: a day counts as attended when the child
-- completed at least one lesson scheduled for that day. This table only stores
-- exceptions — an absence on a day that would otherwise count, a holiday, or a
-- day that should count despite no lesson records (a field trip, say).
--
-- Data-safe: creates new tables only.

CREATE TABLE IF NOT EXISTS attendance_days (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    status      TEXT NOT NULL DEFAULT 'present'
                    CHECK (status IN ('present', 'absent', 'holiday')),
    -- Overrides the configured per-day default for this one day.
    minutes     INTEGER CHECK (minutes IS NULL OR minutes >= 0),
    note        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (child_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_days_child ON attendance_days(child_id);
CREATE INDEX IF NOT EXISTS idx_attendance_days_date ON attendance_days(date);

-- Small key/value store for app-level configuration a parent edits in the UI.
CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Default instructional minutes credited to an attended day (4 hours).
INSERT INTO app_settings (key, value)
VALUES ('instructional_minutes_per_day', '240')
ON CONFLICT (key) DO NOTHING;
