"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";
import { saveUploadedImage } from "@/lib/server/uploads";

/** Revalidate all routes that display lesson/curriculum/subject data */
function revalidateAll() {
  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/subjects");
  revalidatePath("/curricula");
  revalidatePath("/grades");
  revalidatePath("/students");
  revalidatePath("/reports");
  revalidatePath("/resources");
  revalidatePath("/admin");
}

const statusSchema = z.enum(["planned", "in_progress", "completed"]);
const optionalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export async function updateLessonStatus(id: string, status: string) {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) {
    return { error: "Invalid status" };
  }

  await pool.query("UPDATE lessons SET status = $1 WHERE id = $2", [
    parsed.data,
    id,
  ]);

  revalidateAll();
  return { success: true };
}

const rescheduleSchema = z.object({
  lessonId: z.string().uuid(),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function rescheduleLesson(lessonId: string, newDate: string) {
  const parsed = rescheduleSchema.safeParse({ lessonId, newDate });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  await pool.query(
    "UPDATE lessons SET planned_date = $1 WHERE id = $2",
    [parsed.data.newDate, parsed.data.lessonId]
  );

  revalidateAll();
  return { success: true };
}

/**
 * Move overdue incomplete lessons to today (or next school day).
 * Called lazily on page load. Idempotent.
 */
export async function bumpOverdueLessons(childId: string, today: string) {
  const parsed = z.string().uuid().safeParse(childId);
  if (!parsed.success) return { error: "Invalid childId" };

  const res = await pool.query(
    `UPDATE lessons SET planned_date = $1
     WHERE id IN (
       SELECT l.id FROM lessons l
       JOIN curricula cu ON cu.id = l.curriculum_id
       JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
       WHERE ca.child_id = $2
         AND l.planned_date < $1::date
         AND l.status != 'completed'
     )`,
    [today, childId]
  );

  if (res.rowCount && res.rowCount > 0) {
    revalidateAll();
  }

  return { success: true, bumped: res.rowCount ?? 0 };
}

export async function updateLessonTitle(id: string, title: string) {
  const parsedId = z.string().uuid().safeParse(id);
  const parsedTitle = z.string().min(1).safeParse(title);
  if (!parsedId.success || !parsedTitle.success) return { error: "Invalid input" };

  await pool.query("UPDATE lessons SET title = $1 WHERE id = $2", [
    parsedTitle.data,
    parsedId.data,
  ]);

  revalidateAll();
  return { success: true };
}

export async function bulkUpdateLessonDate(lessonIds: string[], newDate: string) {
  const parsedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(newDate);
  const parsedIds = z.array(z.string().uuid()).min(1).safeParse(lessonIds);
  if (!parsedDate.success || !parsedIds.success) return { error: "Invalid input" };

  for (const id of parsedIds.data) {
    await pool.query("UPDATE lessons SET planned_date = $1 WHERE id = $2", [
      parsedDate.data,
      id,
    ]);
  }

  revalidateAll();
  return { success: true };
}

export async function bulkUpdateLessonStatus(lessonIds: string[], status: string) {
  const parsedStatus = statusSchema.safeParse(status);
  const parsedIds = z.array(z.string().uuid()).min(1).safeParse(lessonIds);
  if (!parsedStatus.success || !parsedIds.success) return { error: "Invalid input" };

  for (const id of parsedIds.data) {
    await pool.query("UPDATE lessons SET status = $1 WHERE id = $2", [
      parsedStatus.data,
      id,
    ]);
  }

  revalidateAll();
  return { success: true };
}

const createLessonSchema = z.object({
  title: z.string().min(1, "Title is required"),
  curriculum_id: z.string().uuid(),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  description: z.string().optional(),
});

export async function createLesson(formData: FormData) {
  const data = createLessonSchema.safeParse({
    title: formData.get("title"),
    curriculum_id: formData.get("curriculum_id"),
    planned_date: formData.get("planned_date") || undefined,
    description: formData.get("description") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { title, curriculum_id, planned_date, description } = data.data;

  const res = await pool.query(
    `INSERT INTO lessons (title, curriculum_id, planned_date, description)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [title, curriculum_id, planned_date || null, description || null]
  );

  revalidateAll();
  return { success: true, id: res.rows[0].id };
}

const updateLessonSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  curriculum_id: z.string().uuid(),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  description: z.string().optional(),
});

export async function updateLesson(formData: FormData) {
  const data = updateLessonSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    curriculum_id: formData.get("curriculum_id"),
    planned_date: formData.get("planned_date") || undefined,
    description: formData.get("description") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, title, curriculum_id, planned_date, description } = data.data;

  await pool.query(
    `UPDATE lessons SET title = $1, curriculum_id = $2, planned_date = $3, description = $4
     WHERE id = $5`,
    [title, curriculum_id, planned_date || null, description || null, id]
  );

  revalidateAll();
  return { success: true };
}

export async function deleteLesson(lessonId: string) {
  const parsed = z.string().uuid().safeParse(lessonId);
  if (!parsed.success) return { error: "Invalid lesson ID" };

  await pool.query("DELETE FROM lessons WHERE id = $1", [parsed.data]);

  revalidateAll();
  return { success: true };
}

const createSubjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
});

export async function createSubject(formData: FormData) {
  const data = createSubjectSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { name, color } = data.data;

  const uploadedThumbnail = formData.get("thumbnail_file");
  const savedThumbnail = await saveUploadedImage(
    uploadedThumbnail instanceof File ? uploadedThumbnail : null,
    "subjects"
  );
  if (savedThumbnail && "error" in savedThumbnail) return savedThumbnail;

  const res = await pool.query(
    `INSERT INTO subjects (name, color, thumbnail_url)
     VALUES ($1, $2, $3) RETURNING id`,
    [name, color || null, savedThumbnail?.path || null]
  );

  revalidateAll();
  return { success: true, id: res.rows[0].id };
}

const createCurriculumSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subject_id: z.string().uuid(),
  description: z.string().optional(),
  course_type: z.enum(["curriculum", "unit_study"]).optional(),
  status: z.enum(["active", "archived", "draft"]).optional(),
  start_date: optionalDateSchema,
  end_date: optionalDateSchema,
  notes: z.string().optional(),
  child_id: z.string().uuid().optional(),
  school_year_id: z.string().uuid().optional(),
});

export async function createCurriculum(formData: FormData) {
  const data = createCurriculumSchema.safeParse({
    name: formData.get("name"),
    subject_id: formData.get("subject_id"),
    description: formData.get("description") || undefined,
    course_type: formData.get("course_type") || undefined,
    status: formData.get("status") || undefined,
    start_date: formData.get("start_date") || undefined,
    end_date: formData.get("end_date") || undefined,
    notes: formData.get("notes") || undefined,
    child_id: formData.get("child_id") || undefined,
    school_year_id: formData.get("school_year_id") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const {
    name,
    subject_id,
    description,
    course_type,
    status,
    start_date,
    end_date,
    notes,
    child_id,
    school_year_id,
  } = data.data;

  const uploadedCover = formData.get("cover_image_file");
  const savedCover = await saveUploadedImage(
    uploadedCover instanceof File ? uploadedCover : null,
    "curricula"
  );
  if (savedCover && "error" in savedCover) return savedCover;

  const res = await pool.query(
    `INSERT INTO curricula (name, subject_id, description, cover_image, course_type, status, start_date, end_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      name,
      subject_id,
      description || null,
      savedCover?.path || null,
      course_type || "curriculum",
      status || "active",
      start_date || null,
      end_date || null,
      notes || null,
    ]
  );

  const curriculumId = res.rows[0].id;

  // If child_id and school_year_id provided, create the assignment
  if (child_id && school_year_id) {
    await pool.query(
      `INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id)
       VALUES ($1, $2, $3)`,
      [curriculumId, child_id, school_year_id]
    );
  }

  revalidateAll();
  return { success: true, id: curriculumId };
}

const assignCurriculumSchema = z.object({
  curriculum_id: z.string().uuid(),
  child_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
});

export async function assignCurriculum(formData: FormData) {
  const data = assignCurriculumSchema.safeParse({
    curriculum_id: formData.get("curriculum_id"),
    child_id: formData.get("child_id"),
    school_year_id: formData.get("school_year_id"),
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { curriculum_id, child_id, school_year_id } = data.data;

  await pool.query(
    `INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (curriculum_id, child_id, school_year_id) DO NOTHING`,
    [curriculum_id, child_id, school_year_id]
  );

  revalidateAll();
  return { success: true };
}

export async function unassignCurriculum(curriculumId: string, childId: string) {
  const parsedCu = z.string().uuid().safeParse(curriculumId);
  const parsedCh = z.string().uuid().safeParse(childId);
  if (!parsedCu.success || !parsedCh.success) return { error: "Invalid input" };

  await pool.query(
    `DELETE FROM curriculum_assignments WHERE curriculum_id = $1 AND child_id = $2`,
    [parsedCu.data, parsedCh.data]
  );

  revalidateAll();
  return { success: true };
}

const updateSubjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

export async function updateSubject(formData: FormData) {
  const data = updateSubjectSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color") || undefined,
    thumbnail_url: formData.get("thumbnail_url") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, name, color, thumbnail_url } = data.data;

  const uploadedThumbnail = formData.get("thumbnail_file");
  const savedThumbnail = await saveUploadedImage(
    uploadedThumbnail instanceof File ? uploadedThumbnail : null,
    "subjects"
  );
  if (savedThumbnail && "error" in savedThumbnail) return savedThumbnail;

  const clearThumbnail = formData.get("clear_thumbnail") === "true";
  const nextThumbnailUrl = clearThumbnail
    ? null
    : savedThumbnail?.path || thumbnail_url || null;

  await pool.query(
    `UPDATE subjects SET name = $1, color = $2, thumbnail_url = $3 WHERE id = $4`,
    [name, color || null, nextThumbnailUrl, id]
  );

  revalidateAll();
  return { success: true };
}

export async function deleteSubject(subjectId: string) {
  const parsed = z.string().uuid().safeParse(subjectId);
  if (!parsed.success) return { error: "Invalid subject ID" };

  await pool.query("DELETE FROM subjects WHERE id = $1", [parsed.data]);

  revalidateAll();
  return { success: true };
}

const updateCurriculumSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  subject_id: z.string().uuid().optional(),
  course_type: z.enum(["curriculum", "unit_study"]).optional(),
  status: z.enum(["active", "archived", "draft"]).optional(),
  start_date: optionalDateSchema,
  end_date: optionalDateSchema,
  notes: z.string().optional(),
  cover_image: z.string().optional(),
});

export async function updateCurriculum(formData: FormData) {
  const data = updateCurriculumSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    subject_id: formData.get("subject_id") || undefined,
    course_type: formData.get("course_type") || undefined,
    status: formData.get("status") || undefined,
    start_date: formData.get("start_date") || undefined,
    end_date: formData.get("end_date") || undefined,
    notes: formData.get("notes") || undefined,
    cover_image: formData.get("cover_image") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, name, description, subject_id, course_type, status, start_date, end_date, notes, cover_image } = data.data;

  const existingRes = await pool.query(
    `SELECT cover_image, course_type, status, start_date::text, end_date::text, notes
     FROM curricula WHERE id = $1`,
    [id]
  );
  if (!existingRes.rows[0]) {
    return { error: "Curriculum not found" };
  }
  const existing = existingRes.rows[0] as {
    cover_image: string | null;
    course_type: "curriculum" | "unit_study" | null;
    status: "active" | "archived" | "draft" | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
  };

  const uploadedCover = formData.get("cover_image_file");
  const savedCover = await saveUploadedImage(
    uploadedCover instanceof File ? uploadedCover : null,
    "curricula"
  );
  if (savedCover && "error" in savedCover) return savedCover;

  const clearCoverImage = formData.get("clear_cover_image") === "true";
  const nextCoverImage = clearCoverImage
    ? null
    : savedCover?.path || cover_image || existing.cover_image || null;
  const nextCourseType = course_type || existing.course_type || "curriculum";
  const nextStatus = status || existing.status || "active";
  const nextStartDate = start_date || existing.start_date || null;
  const nextEndDate = end_date || existing.end_date || null;
  const nextNotes = notes || existing.notes || null;

  if (subject_id) {
    await pool.query(
      `UPDATE curricula
       SET name = $1, description = $2, subject_id = $3, cover_image = $4,
           course_type = $5, status = $6, start_date = $7, end_date = $8, notes = $9
       WHERE id = $10`,
      [
        name,
        description || null,
        subject_id,
        nextCoverImage,
        nextCourseType,
        nextStatus,
        nextStartDate,
        nextEndDate,
        nextNotes,
        id,
      ]
    );
  } else {
    await pool.query(
      `UPDATE curricula
       SET name = $1, description = $2, cover_image = $3,
           course_type = $4, status = $5, start_date = $6, end_date = $7, notes = $8
       WHERE id = $9`,
      [
        name,
        description || null,
        nextCoverImage,
        nextCourseType,
        nextStatus,
        nextStartDate,
        nextEndDate,
        nextNotes,
        id,
      ]
    );
  }

  revalidateAll();
  return { success: true };
}

export async function deleteCurriculum(curriculumId: string) {
  const parsed = z.string().uuid().safeParse(curriculumId);
  if (!parsed.success) return { error: "Invalid curriculum ID" };

  await pool.query("DELETE FROM curricula WHERE id = $1", [parsed.data]);

  revalidateAll();
  return { success: true };
}
