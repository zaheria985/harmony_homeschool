export function normalizeWeekdays(weekdays: number[]) {
  return Array.from(new Set(weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))).sort(
    (a, b) => a - b
  );
}

export function hasWeekdayChanges(draftWeekdays: number[], currentWeekdays: number[]) {
  return (
    normalizeWeekdays(draftWeekdays).join(",") !==
    normalizeWeekdays(currentWeekdays).join(",")
  );
}
