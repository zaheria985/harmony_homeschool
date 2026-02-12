"use server";

import { z } from "zod";
import { chatCompletion, isLlmConfigured } from "@/lib/llm";

const suggestSchema = z.object({
  subjectName: z.string().min(1),
  curriculumName: z.string().min(1),
  existingTitles: z.array(z.string()),
  count: z.number().int().min(1).max(20).default(5),
});

export async function suggestLessons(input: {
  subjectName: string;
  curriculumName: string;
  existingTitles: string[];
  count?: number;
}): Promise<{ suggestions: string[] } | { error: string }> {
  if (!isLlmConfigured()) {
    return { error: "AI is not configured. Set LLM_API_KEY in your environment." };
  }

  const parsed = suggestSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };

  const { subjectName, curriculumName, existingTitles, count } = parsed.data;

  try {
    const existing =
      existingTitles.length > 0
        ? `\n\nExisting lessons (do not repeat these):\n${existingTitles.map((t) => `- ${t}`).join("\n")}`
        : "";

    const response = await chatCompletion([
      {
        role: "system",
        content:
          "You are a homeschool curriculum assistant. You suggest lesson titles that are clear, specific, and age-appropriate. Return ONLY a JSON array of strings, no other text.",
      },
      {
        role: "user",
        content: `Suggest ${count} lesson titles for a homeschool curriculum.\n\nSubject: ${subjectName}\nCurriculum/Unit: ${curriculumName}${existing}\n\nReturn a JSON array of ${count} lesson title strings.`,
      },
    ]);

    const cleaned = response.content.replace(/```json\n?|\n?```/g, "").trim();
    let suggestions: unknown;

    try {
      suggestions = JSON.parse(cleaned);
    } catch {
      return { error: "AI returned invalid JSON" };
    }

    if (!Array.isArray(suggestions) || !suggestions.every((s) => typeof s === "string")) {
      return { error: "AI returned unexpected format" };
    }

    return { suggestions: suggestions.slice(0, count) };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "AI request failed",
    };
  }
}
