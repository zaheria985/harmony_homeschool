import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { getProgressReport } from "@/lib/queries/reports";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const childId = searchParams.get("childId");
  if (!childId) {
    return NextResponse.json({ error: "childId required" }, { status: 400 });
  }
  const yearId = searchParams.get("yearId") || undefined;

  // Get child name
  const childRes = await pool.query(
    "SELECT name FROM children WHERE id = $1",
    [childId],
  );
  const childName = childRes.rows[0]?.name || "Student";

  // Get school year label if provided
  let yearLabel = "";
  if (yearId) {
    const yearRes = await pool.query(
      "SELECT label FROM school_years WHERE id = $1",
      [yearId],
    );
    yearLabel = yearRes.rows[0]?.label || "";
  }

  // Get report data
  const report = await getProgressReport(childId, yearId);

  // Generate PDF
  const doc = new PDFDocument({ size: "letter", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));

  // Title
  doc.fontSize(20).font("Helvetica-Bold").text("Report Card", { align: "center" });
  doc.moveDown(0.5);
  doc.fontSize(14).font("Helvetica").text(childName, { align: "center" });
  if (yearLabel) {
    doc.fontSize(11).text(yearLabel, { align: "center" });
  }
  doc.moveDown(1);

  // Overall Summary
  doc.fontSize(12).font("Helvetica-Bold").text("Overall Summary");
  doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).font("Helvetica");

  const overall = report.overall;
  const completionPct =
    Number(overall.total_lessons) > 0
      ? Math.round(
          (Number(overall.completed) / Number(overall.total_lessons)) * 100,
        )
      : 0;
  doc.text(
    `Total Lessons: ${overall.total_lessons}    Completed: ${overall.completed}    Completion: ${completionPct}%`,
  );
  if (Number(overall.avg_grade) > 0) {
    doc.text(`Average Grade: ${Number(overall.avg_grade).toFixed(1)}%`);
  }
  doc.moveDown(1);

  // Subject Breakdown
  doc.fontSize(12).font("Helvetica-Bold").text("Subject Breakdown");
  doc.moveTo(50, doc.y).lineTo(562, doc.y).stroke();
  doc.moveDown(0.5);

  // Table header
  const col1 = 50;
  const col2 = 200;
  const col3 = 280;
  const col4 = 350;
  const col5 = 430;
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Subject", col1, doc.y, { continued: false });
  const headerY = doc.y - 11;
  doc.text("Completed", col2, headerY);
  doc.text("Total", col3, headerY);
  doc.text("Avg Grade", col4, headerY);
  doc.text("Status", col5, headerY);
  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(9);
  for (const subject of report.subjects) {
    const subjectPct =
      Number(subject.total_lessons) > 0
        ? Math.round(
            (Number(subject.completed) / Number(subject.total_lessons)) * 100,
          )
        : 0;
    const status =
      subjectPct === 100
        ? "Complete"
        : subjectPct > 0
          ? "In Progress"
          : "Not Started";
    const grade =
      Number(subject.avg_grade) > 0
        ? `${Number(subject.avg_grade).toFixed(1)}%`
        : "\u2014";

    const y = doc.y;
    doc.text(String(subject.subject_name), col1, y);
    doc.text(String(subject.completed), col2, y);
    doc.text(String(subject.total_lessons), col3, y);
    doc.text(grade, col4, y);
    doc.text(status, col5, y);
    doc.moveDown(0.2);
  }

  doc.moveDown(1);

  // Footer
  doc
    .fontSize(8)
    .fillColor("#999999")
    .text(
      `Generated on ${new Date().toLocaleDateString()} \u2014 Harmony Homeschool`,
      50,
      720,
      { align: "center" },
    );

  doc.end();

  // Wait for PDF to finish
  const pdfBuffer = await new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="report-card-${childName.toLowerCase().replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
