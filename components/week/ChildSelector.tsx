"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
export default function ChildSelector({
  children,
  defaultChildId,
}: {
  children: { id: string; name: string }[];
  defaultChildId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentChildId = searchParams.get("child") || defaultChildId;
  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("child", e.target.value);
    router.push(`${pathname}?${params.toString()}`);
  }
  return (
    <select
      value={currentChildId}
      onChange={handleChange}
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-secondary shadow-sm hover:border-interactive-border focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
    >
      {" "}
      <option value="all">All Kids</option>
      {children.map((child) => (
        <option key={child.id} value={child.id}>
          {child.name}
        </option>
      ))}
    </select>
  );
}
