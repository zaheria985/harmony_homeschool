import Link from "next/link";

export const STUDENT_TABS = [
  { key: "overview", label: "Overview" },
  { key: "grades", label: "Grades" },
  { key: "reading", label: "Reading" },
  { key: "attendance", label: "Attendance" },
] as const;

export type StudentTabKey = (typeof STUDENT_TABS)[number]["key"];

export function parseStudentTab(value: string | undefined): StudentTabKey {
  return STUDENT_TABS.some((tab) => tab.key === value)
    ? (value as StudentTabKey)
    : "overview";
}

/**
 * Tabs are links, not client state, so each panel fetches only its own data
 * and a bookmarked URL lands where it should.
 */
export default function StudentTabs({
  childId,
  active,
  yearId,
}: {
  childId: string;
  active: StudentTabKey;
  yearId?: string;
}) {
  return (
    <nav
      aria-label="Student sections"
      className="mb-5 flex gap-1 overflow-x-auto border-b border-border"
    >
      {STUDENT_TABS.map((tab) => {
        const query = new URLSearchParams();
        if (tab.key !== "overview") query.set("tab", tab.key);
        if (yearId) query.set("yearId", yearId);
        const suffix = query.toString();
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={`/students/${childId}${suffix ? `?${suffix}` : ""}`}
            aria-current={isActive ? "page" : undefined}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors ${
              isActive
                ? "border-b-[var(--interactive)] font-medium text-interactive"
                : "border-b-transparent text-tertiary hover:text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
