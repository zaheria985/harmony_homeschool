"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import LessonCard from "./LessonCard";
import LessonDetailModal from "@/components/lessons/LessonDetailModal";
import type { DaySubjectLesson } from "@/lib/queries/week";

export default function LessonCardList({ lessons }: { lessons: DaySubjectLesson[] }) {
  const router = useRouter();
  const [detailLessonId, setDetailLessonId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  function handleLessonClick(id: string) {
    setDetailLessonId(id);
    setDetailOpen(true);
  }

  function handleChanged() {
    router.refresh();
    setDetailOpen(false);
  }

  return (
    <>
      <div className="space-y-3">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} onLessonClick={handleLessonClick} />
        ))}
      </div>
      <LessonDetailModal
        lessonId={detailLessonId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {}}
        onChanged={handleChanged}
      />
    </>
  );
}
