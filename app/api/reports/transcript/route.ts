import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PDFDocument from "pdfkit";
import { resolveParentChildScopeForRequest } from "@/lib/auth-scope";
import { getTranscript, letterFromPercent } from "@/lib/queries/transcript";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; role?: string; child_id?: string | null }
    | undefined;
  if (!user || user.role === "kid") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const childId = searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ error: "childId required" }, { status: 400 });
  }

  const scope = await resolveParentChildScopeForRequest(user, childId);
  if (scope.error) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const yearIds = searchParams.getAll("yearId").filter(Boolean);
  const transcript = await getTranscript(childId, yearIds);
  if (!transcript) {
    return NextResponse.json({ error: "Child not found" }, { status: 404 });
  }

  const doc = new PDFDocument({ size: "letter", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(20).font("Helvetica-Bold").text("Academic Transcript", {
    align: "center",
  });
  doc.moveDown(0.4);
  doc.fontSize(14).font("Helvetica").text(transcript.childName, {
    align: "center",
  });
  doc.moveDown(1);

  // Column layout, reused by the header and every row.
  const columns = { course: 50, year: 250, grade: 350, credits: 440, done: 500 };

  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Course", columns.course, doc.y, { continued: false });
  const headerY = doc.y - doc.currentLineHeight();
  doc.text("Year", columns.year, headerY);
  doc.text("Grade", columns.grade, headerY);
  doc.text("Credits", columns.credits, headerY);
  doc.text("Done", columns.done, headerY);
  doc.moveTo(50, doc.y + 2).lineTo(562, doc.y + 2).stroke();
  doc.moveDown(0.6);

  doc.font("Helvetica").fontSize(9);

  if (transcript.courses.length === 0) {
    doc.text("No courses assigned.", columns.course);
  }

  for (const course of transcript.courses) {
    // Start a new page before the footer area rather than writing over it.
    if (doc.y > 680) {
      doc.addPage();
      doc.fontSize(9).font("Helvetica");
    }

    const rowY = doc.y;
    const gradeText =
      course.numericGrade !== null
        ? `${course.numericGrade.toFixed(1)}% (${letterFromPercent(course.numericGrade)})`
        : (course.passFail ?? "—");

    doc.text(`${course.subjectName}: ${course.courseName}`, columns.course, rowY, {
      width: columns.year - columns.course - 10,
    });
    const afterCourseY = doc.y;

    doc.text(course.yearLabel, columns.year, rowY, {
      width: columns.grade - columns.year - 10,
    });
    doc.text(gradeText, columns.grade, rowY, {
      width: columns.credits - columns.grade - 10,
    });
    doc.text(
      course.credits !== null ? course.credits.toFixed(2) : "—",
      columns.credits,
      rowY,
    );
    doc.text(
      `${course.lessonsCompleted}/${course.lessonsTotal}`,
      columns.done,
      rowY,
    );

    // A wrapped course name may be taller than the other cells.
    doc.y = Math.max(afterCourseY, rowY + doc.currentLineHeight());
    doc.moveDown(0.25);
  }

  doc.moveDown(0.8);
  doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(`Total credits: ${transcript.totalCredits.toFixed(2)}`);
  if (transcript.gpa !== null) {
    doc.text(`GPA (4.0 scale): ${transcript.gpa.toFixed(2)}`);
  }

  doc
    .fontSize(8)
    .font("Helvetica")
    .fillColor("#999999")
    .text(
      `Generated on ${new Date().toLocaleDateString()} — Harmony Homeschool`,
      50,
      720,
      { align: "center" },
    );

  doc.end();

  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  const slug = transcript.childName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="transcript-${slug}.pdf"`,
    },
  });
}
