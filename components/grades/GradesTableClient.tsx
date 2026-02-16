"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import EditableCell from "@/components/ui/EditableCell";
import { updateGrade } from "@/lib/actions/completions";

type GradeRow = {
  completion_id: string;
  grade: number;
  notes: string | null;
  completed_at: string;
  lesson_title: string;
  lesson_id: string;
  subject_id: string;
  subject_name: string;
  child_name: string;
};

export default function GradesTableClient({ grades }: { grades: GradeRow[] }) {
  const router = useRouter();

  async function saveGrade(completionId: string, notes: string | null, value: string) {
    const formData = new FormData();
    formData.set("completionId", completionId);
    formData.set("grade", value);
    formData.set("notes", notes || "");
    const result = await updateGrade(formData);
    if ("error" in result) return { error: result.error || "Failed to update grade" };
    router.refresh();
    return { success: true };
  }

  async function saveNotes(completionId: string, grade: number, value: string) {
    const formData = new FormData();
    formData.set("completionId", completionId);
    formData.set("grade", String(grade));
    formData.set("notes", value);
    const result = await updateGrade(formData);
    if ("error" in result) return { error: result.error || "Failed to update notes" };
    router.refresh();
    return { success: true };
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted">
            <th className="pb-3 font-medium">Student</th>
            <th className="pb-3 font-medium">Lesson</th>
            <th className="pb-3 font-medium">Subject</th>
            <th className="pb-3 font-medium">Grade</th>
            <th className="pb-3 font-medium">Notes</th>
            <th className="pb-3 font-medium">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {grades.map((g) => (
            <tr key={g.completion_id} className="hover:bg-surface-muted">
              <td className="py-3 font-medium">{g.child_name}</td>
              <td className="py-3">
                <Link
                  href={`/lessons/${g.lesson_id}`}
                  className="text-interactive hover:underline"
                >
                  {g.lesson_title}
                </Link>
              </td>
              <td className="py-3">
                <Link href={`/subjects/${g.subject_id}`}>
                  <Badge variant="primary">{g.subject_name}</Badge>
                </Link>
              </td>
              <td className="py-3">
                <EditableCell
                  value={String(Number(g.grade).toFixed(0))}
                  onSave={(value) => saveGrade(g.completion_id, g.notes, value)}
                  className={
                    Number(g.grade) >= 90
                      ? "font-semibold text-success-600"
                      : Number(g.grade) >= 80
                        ? "font-semibold text-interactive"
                        : Number(g.grade) >= 70
                          ? "font-semibold text-warning-600"
                          : "font-semibold text-[var(--error-text)]"
                  }
                />
              </td>
              <td className="py-3 text-muted">
                <EditableCell
                  value={g.notes || ""}
                  onSave={(value) => saveNotes(g.completion_id, g.grade, value)}
                />
              </td>
              <td className="py-3 text-muted">
                {new Date(g.completed_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
