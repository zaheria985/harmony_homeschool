import test from "node:test";
import assert from "node:assert/strict";
import {
  dateKeyInTimeZone,
  todayKey,
  appTimeZone,
  DEFAULT_APP_TIMEZONE,
} from "../lib/utils/timezone";

/** Run a body with APP_TIMEZONE set, always restoring the previous value. */
function withTimeZone(tz: string | undefined, body: () => void) {
  const original = process.env.APP_TIMEZONE;
  if (tz === undefined) delete process.env.APP_TIMEZONE;
  else process.env.APP_TIMEZONE = tz;
  try {
    body();
  } finally {
    if (original === undefined) delete process.env.APP_TIMEZONE;
    else process.env.APP_TIMEZONE = original;
  }
}

test("the default timezone is US Central", () => {
  assert.equal(DEFAULT_APP_TIMEZONE, "America/Chicago");
  withTimeZone(undefined, () => {
    assert.equal(appTimeZone(), "America/Chicago");
  });
});

test("late-evening UTC resolves to the previous day in US Central", () => {
  // 2026-07-23T02:00Z is still 2026-07-22 21:00 in Chicago (CDT, UTC-5).
  // A container running UTC would otherwise bump lessons a day early.
  const instant = new Date("2026-07-23T02:00:00Z");

  assert.equal(dateKeyInTimeZone(instant, "UTC"), "2026-07-23");
  assert.equal(dateKeyInTimeZone(instant, "America/Chicago"), "2026-07-22");
});

test("the CDT/CST offset change is handled", () => {
  // Summer (CDT, UTC-5): the day flips at 05:00Z.
  assert.equal(
    dateKeyInTimeZone(new Date("2026-07-05T04:59:00Z"), "America/Chicago"),
    "2026-07-04"
  );
  assert.equal(
    dateKeyInTimeZone(new Date("2026-07-05T05:00:00Z"), "America/Chicago"),
    "2026-07-05"
  );

  // Winter (CST, UTC-6): the day flips an hour later, at 06:00Z.
  assert.equal(
    dateKeyInTimeZone(new Date("2026-01-05T05:00:00Z"), "America/Chicago"),
    "2026-01-04"
  );
  assert.equal(
    dateKeyInTimeZone(new Date("2026-01-05T06:00:00Z"), "America/Chicago"),
    "2026-01-05"
  );
});

test("daytime UTC and Central agree on the same day", () => {
  const instant = new Date("2026-07-22T14:00:00Z"); // 09:00 in Chicago
  assert.equal(dateKeyInTimeZone(instant, "UTC"), "2026-07-22");
  assert.equal(dateKeyInTimeZone(instant, "America/Chicago"), "2026-07-22");
});

test("date keys are zero-padded ISO order", () => {
  const instant = new Date("2026-01-05T12:00:00Z");
  assert.equal(dateKeyInTimeZone(instant, "UTC"), "2026-01-05");
});

test("todayKey honors APP_TIMEZONE", () => {
  const instant = new Date("2026-07-23T02:00:00Z");

  withTimeZone("UTC", () => {
    assert.equal(todayKey(instant), "2026-07-23");
  });

  withTimeZone("America/Chicago", () => {
    assert.equal(todayKey(instant), "2026-07-22");
  });
});

test("an invalid APP_TIMEZONE falls back instead of throwing", () => {
  withTimeZone("Not/AZone", () => {
    assert.equal(appTimeZone(), DEFAULT_APP_TIMEZONE);
  });
});
