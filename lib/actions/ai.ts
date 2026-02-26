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

// ==========================================================================
// Generate Lesson Description
// ==========================================================================

const lessonDescriptionSchema = z.object({
  title: z.string().min(1, "Lesson title is required"),
  subject: z.string().min(1, "Subject is required"),
  curriculum: z.string().min(1, "Curriculum is required"),
});

export async function generateLessonDescription(formData: FormData): Promise<
  { success: true; description: string } | { error: string }
> {
  if (!isLlmConfigured()) {
    return { error: "AI is not configured. Set LLM_API_KEY in your environment." };
  }

  const parsed = lessonDescriptionSchema.safeParse({
    title: formData.get("title"),
    subject: formData.get("subject"),
    curriculum: formData.get("curriculum"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { title, subject, curriculum } = parsed.data;

  try {
    const response = await chatCompletion([
      {
        role: "system",
        content:
          "You are a homeschool curriculum assistant. Generate brief, practical lesson descriptions with learning objectives. Keep responses to 2-3 sentences. Do not use markdown formatting.",
      },
      {
        role: "user",
        content: `Generate a brief lesson description and learning objectives for:\n  Subject: ${subject}\n  Course: ${curriculum}\n  Lesson: ${title}\n  Keep it to 2-3 sentences.`,
      },
    ]);

    return { success: true, description: response.content.trim() };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "AI request failed",
    };
  }
}

// ==========================================================================
// Generate Curriculum Plan
// ==========================================================================

const curriculumPlanSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  gradeLevel: z.string().min(1, "Grade level is required"),
  weeks: z.coerce.number().int().min(1).max(52).default(36),
});

export async function generateCurriculumPlan(formData: FormData): Promise<
  { success: true; lessons: { title: string; description: string }[] } | { error: string }
> {
  if (!isLlmConfigured()) {
    return { error: "AI is not configured. Set LLM_API_KEY in your environment." };
  }

  const parsed = curriculumPlanSchema.safeParse({
    subject: formData.get("subject"),
    gradeLevel: formData.get("gradeLevel"),
    weeks: formData.get("weeks") || "36",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { subject, gradeLevel, weeks } = parsed.data;

  try {
    const response = await chatCompletion([
      {
        role: "system",
        content:
          "You are a homeschool curriculum planning assistant. Create age-appropriate curriculum outlines. Return ONLY a JSON array, no other text.",
      },
      {
        role: "user",
        content: `Create a ${weeks}-week curriculum outline for ${subject} at ${gradeLevel} grade level.\n    Return as JSON array: [{"title": "Lesson 1 title", "description": "brief description"}]\n    Keep lesson titles concise. Return exactly ${weeks} lessons.`,
      },
    ]);

    const cleaned = response.content.replace(/```json\n?|\n?```/g, "").trim();
    let lessons: unknown;

    try {
      lessons = JSON.parse(cleaned);
    } catch {
      return { error: "AI returned invalid JSON" };
    }

    if (
      !Array.isArray(lessons) ||
      !lessons.every(
        (l) =>
          typeof l === "object" &&
          l !== null &&
          typeof (l as Record<string, unknown>).title === "string"
      )
    ) {
      return { error: "AI returned unexpected format" };
    }

    return {
      success: true,
      lessons: (lessons as { title: string; description?: string }[]).map((l) => ({
        title: l.title,
        description: l.description || "",
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "AI request failed",
    };
  }
}

// ==========================================================================
// Suggest Resources for a Lesson
// ==========================================================================

const suggestResourcesSchema = z.object({
  lessonTitle: z.string().min(1, "Lesson title is required"),
  subject: z.string().min(1, "Subject is required"),
});

export async function suggestResources(formData: FormData): Promise<
  { success: true; suggestions: { title: string; type: string; description: string }[] } | { error: string }
> {
  if (!isLlmConfigured()) {
    return { error: "AI is not configured. Set LLM_API_KEY in your environment." };
  }

  const parsed = suggestResourcesSchema.safeParse({
    lessonTitle: formData.get("lessonTitle"),
    subject: formData.get("subject"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const { lessonTitle, subject } = parsed.data;

  try {
    const response = await chatCompletion([
      {
        role: "system",
        content:
          "You are a homeschool resource advisor. Suggest practical learning resources for homeschool lessons. Return ONLY a JSON array, no other text.",
      },
      {
        role: "user",
        content: `Suggest 3-5 learning resources for a homeschool lesson:\n    Subject: ${subject}\n    Lesson: ${lessonTitle}\n    Return as JSON: [{"title": "...", "type": "book|video|url", "description": "..."}]`,
      },
    ]);

    const cleaned = response.content.replace(/```json\n?|\n?```/g, "").trim();
    let suggestions: unknown;

    try {
      suggestions = JSON.parse(cleaned);
    } catch {
      return { error: "AI returned invalid JSON" };
    }

    if (
      !Array.isArray(suggestions) ||
      !suggestions.every(
        (s) =>
          typeof s === "object" &&
          s !== null &&
          typeof (s as Record<string, unknown>).title === "string"
      )
    ) {
      return { error: "AI returned unexpected format" };
    }

    return {
      success: true,
      suggestions: (suggestions as { title: string; type?: string; description?: string }[]).map((s) => ({
        title: s.title,
        type: s.type || "url",
        description: s.description || "",
      })),
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "AI request failed",
    };
  }
}
