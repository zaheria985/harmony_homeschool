"use client";

import { ViewToggleNav } from "@/components/ui/ViewToggle";

export function CurriculumViewToggle({
  curriculumId,
}: {
  curriculumId: string;
}) {
  return (
    <ViewToggleNav
      options={[
        { key: "list", label: "List View", href: `/curricula/${curriculumId}` },
        { key: "board", label: "Board View", href: `/curricula/${curriculumId}/board` },
      ]}
    />
  );
}
