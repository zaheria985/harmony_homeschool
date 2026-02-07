import Link from "next/link";
import Badge from "@/components/ui/Badge";
import LessonCheckbox from "./LessonCheckbox";
import RescheduleButton from "./RescheduleButton";
import ResourceEmbed from "./ResourceEmbed";
import type { DaySubjectLesson } from "@/lib/queries/week";

export default function LessonCard({ lesson }: { lesson: DaySubjectLesson }) {
  const isCompleted = lesson.status === "completed";

  return (
    <div
      className={`rounded-xl border p-4 ${
        isCompleted ? "border-success-200 bg-success-50/30" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <LessonCheckbox
            lessonId={lesson.id}
            childId={lesson.child_id}
            isCompleted={isCompleted}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/lessons/${lesson.id}`}
              className={`font-medium hover:underline ${
                isCompleted ? "text-gray-400 line-through" : "text-primary-600"
              }`}
            >
              {lesson.title}
            </Link>
            {isCompleted && <Badge variant="success">Done</Badge>}
            {lesson.status === "in_progress" && <Badge variant="warning">In Progress</Badge>}
          </div>
          {lesson.curriculum_name && (
            <p className="mt-0.5 text-xs">
              <Link href={`/curricula/${lesson.curriculum_id}`} className="text-gray-400 hover:text-primary-600 hover:underline">
                {lesson.curriculum_name}
              </Link>
            </p>
          )}
          {lesson.description && (
            <p className="mt-1.5 text-sm text-gray-600">{lesson.description}</p>
          )}
          {lesson.grade !== null && (
            <p className="mt-1 text-sm text-gray-500">
              Grade: <span className="font-medium">{lesson.grade}%</span>
            </p>
          )}
          {lesson.completion_notes && (
            <p className="mt-1 text-sm italic text-gray-400">{lesson.completion_notes}</p>
          )}
          {lesson.resources.length > 0 && (
            <div className="mt-3 space-y-2">
              {lesson.resources.map((resource) => (
                <ResourceEmbed key={resource.id} resource={resource} />
              ))}
            </div>
          )}
          {!isCompleted && (
            <div className="mt-2">
              <RescheduleButton lessonId={lesson.id} currentDate={lesson.planned_date} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
