export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import pool from "@/lib/db";
import { isTrelloConfigured } from "@/lib/trello";
import TrelloImportClient from "./TrelloImportClient";

export default async function TrelloImportPage() {
  if (!isTrelloConfigured()) {
    return (
      <div className="space-y-6">
        <PageHeader title="Trello Import" />
        <Card title="Setup Required">
          <div className="space-y-4 text-sm text-secondary">
            <p>
              Trello integration is not configured. Add the following environment
              variables to enable importing:
            </p>
            <div className="rounded-lg border border-border bg-muted p-4 font-mono text-xs">
              <p>TRELLO_API_KEY=your_api_key</p>
              <p>TRELLO_TOKEN=your_token</p>
            </div>
            <ol className="list-inside list-decimal space-y-2">
              <li>
                Visit{" "}
                <a
                  href="https://trello.com/power-ups/admin"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-interactive underline"
                >
                  trello.com/power-ups/admin
                </a>{" "}
                and create a new Power-Up (or use an existing one) to get your
                API key.
              </li>
              <li>
                Generate a token by clicking the &quot;Token&quot; link on the
                same page.
              </li>
              <li>Add both values to your environment and restart the app.</li>
            </ol>
          </div>
        </Card>
      </div>
    );
  }

  const [curricRes, subjectsRes, childrenRes, yearsRes] = await Promise.all([
    pool.query(
      `SELECT cu.id, cu.name, s.name AS subject_name
       FROM curricula cu
       JOIN subjects s ON s.id = cu.subject_id
       ORDER BY s.name, cu.name`
    ),
    pool.query(`SELECT id, name, color FROM subjects ORDER BY name`),
    pool.query(`SELECT id, name FROM children ORDER BY name`),
    pool.query(
      `SELECT id, label, start_date::text AS start_date, end_date::text AS end_date
       FROM school_years
       ORDER BY start_date DESC`
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Trello Import" />
      <TrelloImportClient
        curricula={curricRes.rows}
        subjects={subjectsRes.rows}
        children={childrenRes.rows}
        schoolYears={yearsRes.rows}
      />
    </div>
  );
}
