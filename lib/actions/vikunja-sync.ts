"use server";

import { revalidatePath } from "next/cache";
import { createTask, updateTask, deleteTask } from "@/lib/vikunja";
import {
  getUpcomingLessonsForSync,
  getUpcomingResourcesForSync,
  getExistingMappings,
  insertMapping,
  deleteMapping,
  getCompletedMappedLessons,
} from "@/lib/queries/vikunja-sync";

interface SyncResult {
  success: boolean;
  error?: string;
  created: number;
  deleted: number;
  skipped: number;
}

export async function syncToVikunja(): Promise<SyncResult> {
  const projectId = Number(process.env.VIKUNJA_PROJECT_ID);
  if (!projectId || !process.env.VIKUNJA_URL || !process.env.VIKUNJA_API_TOKEN) {
    return { success: false, error: "Vikunja not configured", created: 0, deleted: 0, skipped: 0 };
  }

  let created = 0;
  let deleted = 0;
  let skipped = 0;

  try {
    const [lessons, resources, existingMappings, completedMapped] =
      await Promise.all([
        getUpcomingLessonsForSync(),
        getUpcomingResourcesForSync(),
        getExistingMappings(),
        getCompletedMappedLessons(),
      ]);

    // Build lookup sets for existing mappings
    const mappedLessonIds = new Set(
      existingMappings
        .filter((m: Record<string, unknown>) => m.sync_type === "lesson")
        .map((m: Record<string, unknown>) => `${m.lesson_id}:${m.child_id}`)
    );
    const mappedResourceIds = new Set(
      existingMappings
        .filter((m: Record<string, unknown>) => m.sync_type === "resource")
        .map((m: Record<string, unknown>) => `${m.resource_id}:${m.child_id}`)
    );

    // Create tasks for unmapped lessons
    for (const lesson of lessons) {
      const key = `${lesson.id}:${lesson.child_id}`;
      if (mappedLessonIds.has(key)) {
        skipped++;
        continue;
      }

      const dueDate = new Date(lesson.planned_date);
      dueDate.setHours(9, 0, 0, 0);

      const task = await createTask(projectId, {
        title: `[${lesson.subject_name}] ${lesson.title} (${lesson.child_name})`,
        description: lesson.description || `${lesson.curriculum_name}`,
        due_date: dueDate.toISOString(),
      });

      await insertMapping(
        task.id,
        lesson.id,
        null,
        "lesson",
        lesson.child_id
      );
      created++;
    }

    // Create tasks for unmapped resources
    for (const resource of resources) {
      const key = `${resource.id}:${resource.child_id}`;
      if (mappedResourceIds.has(key)) {
        skipped++;
        continue;
      }

      const typeLabel =
        resource.type.charAt(0).toUpperCase() + resource.type.slice(1);
      const dueDate = new Date(resource.planned_date);
      dueDate.setHours(8, 0, 0, 0);

      const description = [
        resource.resource_description,
        resource.url ? `URL: ${resource.url}` : null,
        `For: ${resource.lesson_title} (${resource.child_name})`,
      ]
        .filter(Boolean)
        .join("\n");

      const task = await createTask(projectId, {
        title: `[${typeLabel}] ${resource.title}`,
        description,
        due_date: dueDate.toISOString(),
      });

      await insertMapping(
        task.id,
        resource.lesson_id,
        resource.id,
        "resource",
        resource.child_id
      );
      created++;
    }

    // Clean up: delete Vikunja tasks for completed lessons
    for (const mapping of completedMapped) {
      try {
        await updateTask(mapping.vikunja_task_id, { done: true });
        await deleteMapping(mapping.vikunja_task_id);
        deleted++;
      } catch {
        // Task may already be deleted in Vikunja
        await deleteMapping(mapping.vikunja_task_id);
        deleted++;
      }
    }
  } catch (err) {
    console.error("Vikunja sync failed:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Sync failed",
      created,
      deleted,
      skipped,
    };
  }

  revalidatePath("/dashboard");
  return { success: true, created, deleted, skipped };
}
