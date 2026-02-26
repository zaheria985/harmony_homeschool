export function completionValuePayload(params: {
  gradeType: "numeric" | "pass_fail" | "combo";
  grade?: number | null;
  passFail?: "pass" | "fail";
  notes?: string;
}) {
  // "combo" resolves to numeric or pass_fail at the form level;
  // if it arrives here as "combo", treat it as numeric
  const isPassFail = params.gradeType === "pass_fail";
  return {
    grade: !isPassFail ? params.grade ?? null : null,
    passFail: isPassFail ? params.passFail || "pass" : null,
    notes: params.notes ?? null,
  };
}
