import { Pool } from "pg";
import { hashSync } from "bcryptjs";

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://harmony:claude@localhost:5432/harmony",
});

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clean existing data
    await client.query("DELETE FROM lesson_completions");
    await client.query("DELETE FROM lesson_resources");
    await client.query("DELETE FROM lessons");
    await client.query("DELETE FROM curriculum_assignments");
    await client.query("DELETE FROM curricula");
    await client.query("DELETE FROM subjects");
    await client.query("DELETE FROM school_days");
    await client.query("DELETE FROM date_overrides");
    await client.query("DELETE FROM school_years");
    await client.query("DELETE FROM parent_children");
    await client.query("DELETE FROM children");
    await client.query("DELETE FROM users");

    // 1. Parent user (password: harmony123)
    const passwordHash = hashSync("harmony123", 10);
    const userRes = await client.query(
      `INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, 'parent') RETURNING id`,
      ["parent@harmony.local", passwordHash, "Parent"]
    );
    const userId = userRes.rows[0].id;

    // 2. School year 2025-2026
    const yearRes = await client.query(
      `INSERT INTO school_years (label, start_date, end_date) VALUES ($1, $2, $3) RETURNING id`,
      ["2025-2026", "2025-08-18", "2026-05-29"]
    );
    const yearId = yearRes.rows[0].id;

    // 3. School days: Mon(1) - Fri(5)
    for (let d = 1; d <= 5; d++) {
      await client.query(
        `INSERT INTO school_days (school_year_id, weekday) VALUES ($1, $2)`,
        [yearId, d]
      );
    }

    // 4. Children
    const childNames = ["Emma", "Noah", "Olivia"];
    const childIds: string[] = [];
    for (const name of childNames) {
      const res = await client.query(
        `INSERT INTO children (name) VALUES ($1) RETURNING id`,
        [name]
      );
      childIds.push(res.rows[0].id);
    }

    for (const childId of childIds) {
      await client.query(
        `INSERT INTO parent_children (parent_id, child_id) VALUES ($1, $2)`,
        [userId, childId]
      );
    }

    // 5. Global subjects (shared across all children)
    const subjectDefs = [
      { name: "Math", color: "#6366f1" },
      { name: "Language Arts", color: "#ec4899" },
      { name: "Science", color: "#10b981" },
      { name: "History", color: "#f59e0b" },
      { name: "Art", color: "#8b5cf6" },
    ];

    const subjectIds: string[] = [];
    for (const subDef of subjectDefs) {
      const subRes = await client.query(
        `INSERT INTO subjects (name, color) VALUES ($1, $2) RETURNING id`,
        [subDef.name, subDef.color]
      );
      subjectIds.push(subRes.rows[0].id);
    }

    // Generate school dates for planned_date assignment
    const schoolDates: string[] = [];
    const start = new Date("2025-08-18");
    const end = new Date("2026-05-29");
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (dow >= 1 && dow <= 5) {
        schoolDates.push(d.toISOString().split("T")[0]);
      }
    }

    let lessonCount = 0;
    let completionCount = 0;

    // 6. For each child, create curricula per subject and assign them
    for (const childId of childIds) {
      let dateIdx = 0;

      for (let si = 0; si < subjectDefs.length; si++) {
        const subjectId = subjectIds[si];
        const subDef = subjectDefs[si];

        // 2 curricula per subject per child
        const curriculaNames = [
          `${subDef.name} Foundations`,
          `${subDef.name} Advanced`,
        ];

        for (let ci = 0; ci < 2; ci++) {
          const curRes = await client.query(
            `INSERT INTO curricula (subject_id, name, description, order_index, status, start_date, end_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
              subjectId,
              curriculaNames[ci],
              `${curriculaNames[ci]} curriculum`,
              ci,
              "active",
              "2025-08-18",
              "2026-05-29",
            ]
          );
          const curriculumId = curRes.rows[0].id;

          // Create curriculum_assignment linking this curriculum to the child + school year
          await client.query(
            `INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id) VALUES ($1, $2, $3)`,
            [curriculumId, childId, yearId]
          );

          // 5 lessons per curriculum
          for (let li = 0; li < 5; li++) {
            const plannedDate = schoolDates[dateIdx % schoolDates.length];
            dateIdx++;

            // Determine status: ~60% completed, ~20% in_progress, ~20% planned
            const rand = Math.random();
            let status: string;
            if (rand < 0.6) status = "completed";
            else if (rand < 0.8) status = "in_progress";
            else status = "planned";

            const lessonRes = await client.query(
              `INSERT INTO lessons (curriculum_id, title, description, order_index, planned_date, status)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
              [
                curriculumId,
                `${curriculaNames[ci]} - Lesson ${li + 1}`,
                `Lesson ${li + 1} of ${curriculaNames[ci]}`,
                li,
                plannedDate,
                status,
              ]
            );
            const lessonId = lessonRes.rows[0].id;
            lessonCount++;

            // Add a resource to some lessons
            if (Math.random() < 0.4) {
              await client.query(
                `INSERT INTO lesson_resources (lesson_id, type, url, title) VALUES ($1, $2, $3, $4)`,
                [
                  lessonId,
                  "url",
                  `https://example.com/resource/${li + 1}`,
                  `Resource for Lesson ${li + 1}`,
                ]
              );
            }

            // Create completion for completed lessons
            if (status === "completed") {
              const grade = Math.floor(Math.random() * 31) + 70; // 70-100
              const noteOptions = [
                "Great work!",
                "Needs review",
                "Excellent understanding",
                "Good effort",
                null,
              ];
              const note = noteOptions[Math.floor(Math.random() * noteOptions.length)];
              await client.query(
                `INSERT INTO lesson_completions (lesson_id, child_id, completed_by_user_id, grade, notes)
                 VALUES ($1, $2, $3, $4, $5)`,
                [lessonId, childId, userId, grade, note]
              );
              completionCount++;
            }
          }
        }
      }
    }

    await client.query("COMMIT");
    console.log(`Seeded successfully:`);
    console.log(`  - 1 parent user`);
    console.log(`  - 1 school year (2025-2026)`);
    console.log(`  - ${childNames.length} children: ${childNames.join(", ")}`);
    console.log(`  - ${subjectDefs.length} global subjects`);
    console.log(`  - ${lessonCount} lessons total`);
    console.log(`  - ${completionCount} completions with grades`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
