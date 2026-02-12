export function completionValuePayload(params: {
  gradeType: "numeric" | "pass_fail";
  grade?: number | null;
  passFail?: "pass" | "fail";
  notes?: string;
}) {
  return {
    grade: params.gradeType === "numeric" ? params.grade ?? null : null,
    passFail: params.gradeType === "pass_fail" ? params.passFail || "pass" : null,
    notes: params.notes ?? null,
  };
}
