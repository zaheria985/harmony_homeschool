"use client";

import { useRouter, usePathname } from "next/navigation";

interface SchoolYear {
  id: string;
  label: string;
}

export default function SchoolYearSelector({
  schoolYears,
  currentYearId,
}: {
  schoolYears: SchoolYear[];
  currentYearId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value) {
      router.push(`${pathname}?yearId=${value}`);
    } else {
      router.push(pathname);
    }
  }

  return (
    <select
      value={currentYearId}
      onChange={handleChange}
      className="rounded-lg border border-light bg-surface px-3 py-1.5 text-sm text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
    >
      <option value="">Current Year</option>
      {schoolYears.map((y) => (
        <option key={y.id} value={y.id}>
          {y.label}
        </option>
      ))}
    </select>
  );
}
