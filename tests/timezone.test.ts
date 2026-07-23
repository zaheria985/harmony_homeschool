import test from "node:test";
import assert from "node:assert/strict";
import {
  dateKeyInTimeZone,
  todayKey,
  appTimeZone,
  DEFAULT_APP_TIMEZONE,
} from "../lib/utils/timezone";

test("late-evening UTC resolves to the previous day in US Eastern", () => {
  // 2026-07-23T02:00Z is still 2026-07-22 22:00 in New York. A container
  // running UTC would otherwise bump lessons a day early.
  const instant = new Date("2026-07-23T02:00:00Z");

  assert.equal(dateKeyInTimeZone(instant, "UTC"), "2026-07-23");
  assert.equal(dateKeyInTimeZone(instant, "America/New_York"), "2026-07-22");
});

test("early-morning UTC and Eastern agree on the same day", () => {
  const instant = new Date("2026-07-22T14:00:00Z"); // 10:00 in New York
  assert.equal(dateKeyInTimeZone(instant, "UTC"), "2026-07-22");
  assert.equal(dateKeyInTimeZone(instant, "America/New_York"), "2026-07-22");
});

test("date keys are zero-padded ISO order", () => {
  const instant = new Date("2026-01-05T12:00:00Z");
  assert.equal(dateKeyInTimeZone(instant, "UTC"), "2026-01-05");
});

test("todayKey honors APP_TIMEZONE", () => {
  const original = process.env.APP_TIMEZONE;
  const instant = new Date("2026-07-23T02:00:00Z");

  process.env.APP_TIMEZONE = "UTC";
  assert.equal(todayKey(instant), "2026-07-23");

  process.env.APP_TIMEZONE = "America/New_York";
  assert.equal(todayKey(instant), "2026-07-22");

  if (original === undefined) delete process.env.APP_TIMEZONE;
  else process.env.APP_TIMEZONE = original;
});

test("an invalid APP_TIMEZONE falls back instead of throwing", () => {
  const original = process.env.APP_TIMEZONE;
  process.env.APP_TIMEZONE = "Not/AZone";

  assert.equal(appTimeZone(), DEFAULT_APP_TIMEZONE);

  if (original === undefined) delete process.env.APP_TIMEZONE;
  else process.env.APP_TIMEZONE = original;
});
