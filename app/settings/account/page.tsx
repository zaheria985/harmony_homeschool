export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import pool from "@/lib/db";
import PageHeader from "@/components/ui/PageHeader";
import AccountSettingsClient from "./AccountSettingsClient";

export default async function AccountSettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as { id: string; email?: string | null };
  const res = await pool.query("SELECT email FROM users WHERE id = $1", [
    user.id,
  ]);
  const email = res.rows[0]?.email ?? "";

  return (
    <div>
      <PageHeader title="Account Settings" />
      <AccountSettingsClient userId={user.id} currentEmail={email} />
    </div>
  );
}
