"use client";

import { useState } from "react";
import LessonFormModal from "./LessonFormModal";

type Child = { id: string; name: string };

export default function NewLessonButton({ children }: { children: Child[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
      >
        + New Lesson
      </button>
      <LessonFormModal
        open={open}
        onClose={() => setOpen(false)}
        children={children}
      />
    </>
  );
}
