import { NextResponse } from "next/server";
import { signupAvailability } from "@/lib/server/signup-policy";

export const dynamic = "force-dynamic";

// Public: exposes only whether self-signup is open, no data.
export async function GET() {
  const availability = await signupAvailability();
  return NextResponse.json({ allowed: availability.allowed });
}
