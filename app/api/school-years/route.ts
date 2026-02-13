import { NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const res = await pool.query(
    `SELECT id, name FROM school_years ORDER BY start_date DESC`
  );
  return NextResponse.json({ schoolYears: res.rows });
}
