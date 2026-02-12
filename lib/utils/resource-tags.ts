export function parseTagNames(raw: string | undefined) {
  if (!raw) return [] as string[];
  const names = raw
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(names));
}

export function mergeTagNames(rawTags: string | undefined, extraTags: string[]) {
  const merged = [
    ...parseTagNames(rawTags),
    ...extraTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean),
  ];
  return Array.from(new Set(merged));
}
