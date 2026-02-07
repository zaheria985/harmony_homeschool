"use client";

import { useState } from "react";
import LessonFormModal from "./LessonFormModal";

type Child = { id: string; name: string };

type LessonData = {
  id: string;
  title: string;
  description?: string | null;
  planned_date?: string | null;
  curriculum_id: string;
  child_id?: string;
};

export default function EditLessonButton({
  lesson,
  children,
}: {
  lesson: LessonData;
  children: Child[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
      >
        Edit
      </button>
      <LessonFormModal
        open={open}
        onClose={() => setOpen(false)}
        lesson={lesson}
        children={children}
      />
    </>
  );
}
