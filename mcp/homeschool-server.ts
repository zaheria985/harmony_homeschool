import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import { resolve } from "path";

const DATA_FILE = resolve(process.cwd(), "homeschool-data.json");

interface Activity {
  id: string;
  kid: string;
  activity: string;
  subject: string;
  duration_minutes: number;
  date: string;
  notes: string;
  created_at: string;
}

interface Lesson {
  id: string;
  kid: string;
  subject: string;
  topic: string;
  duration_minutes: number;
  date: string;
  notes: string;
  created_at: string;
}

interface Data {
  kids: string[];
  activities: Activity[];
  lessons: Lesson[];
}

function loadData(): Data {
  if (!existsSync(DATA_FILE)) {
    return { kids: [], activities: [], lessons: [] };
  }
  return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
}

function saveData(data: Data): void {
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getWeekBounds(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

const server = new McpServer({
  name: "homeschool",
  version: "1.0.0",
});

// --- Tools ---

server.tool(
  "add_kid",
  "Register a child by name",
  { name: z.string().describe("Child's name") },
  async ({ name }) => {
    const data = loadData();
    if (data.kids.includes(name)) {
      return { content: [{ type: "text", text: `Kid "${name}" already exists.` }] };
    }
    data.kids.push(name);
    saveData(data);
    return { content: [{ type: "text", text: `Added kid "${name}". Total kids: ${data.kids.length}` }] };
  }
);

server.tool(
  "log_activity",
  "Log an activity for a kid (e.g. field trip, craft, sport)",
  {
    kid: z.string().describe("Child's name"),
    activity: z.string().describe("Activity description"),
    subject: z.string().default("General").describe("Subject area"),
    duration_minutes: z.number().describe("Duration in minutes"),
    date: z.string().describe("Date (YYYY-MM-DD)"),
    notes: z.string().default("").describe("Optional notes"),
  },
  async ({ kid, activity, subject, duration_minutes, date, notes }) => {
    const data = loadData();
    if (!data.kids.includes(kid)) {
      data.kids.push(kid);
    }
    const entry: Activity = {
      id: randomUUID(),
      kid,
      activity,
      subject,
      duration_minutes,
      date,
      notes,
      created_at: new Date().toISOString(),
    };
    data.activities.push(entry);
    saveData(data);
    return { content: [{ type: "text", text: `Logged activity "${activity}" for ${kid} on ${date} (${duration_minutes} min).` }] };
  }
);

server.tool(
  "log_lesson",
  "Log a lesson for a kid",
  {
    kid: z.string().describe("Child's name"),
    subject: z.string().describe("Subject (e.g. Math, Science)"),
    topic: z.string().describe("Lesson topic"),
    duration_minutes: z.number().describe("Duration in minutes"),
    date: z.string().describe("Date (YYYY-MM-DD)"),
    notes: z.string().default("").describe("Optional notes"),
  },
  async ({ kid, subject, topic, duration_minutes, date, notes }) => {
    const data = loadData();
    if (!data.kids.includes(kid)) {
      data.kids.push(kid);
    }
    const entry: Lesson = {
      id: randomUUID(),
      kid,
      subject,
      topic,
      duration_minutes,
      date,
      notes,
      created_at: new Date().toISOString(),
    };
    data.lessons.push(entry);
    saveData(data);
    return { content: [{ type: "text", text: `Logged lesson "${topic}" (${subject}) for ${kid} on ${date} (${duration_minutes} min).` }] };
  }
);

server.tool(
  "list_kids",
  "List all registered kids",
  {},
  async () => {
    const data = loadData();
    if (data.kids.length === 0) {
      return { content: [{ type: "text", text: "No kids registered yet." }] };
    }
    return { content: [{ type: "text", text: `Kids: ${data.kids.join(", ")}` }] };
  }
);

server.tool(
  "list_activities",
  "List activities, optionally filtered by kid and/or date range",
  {
    kid: z.string().optional().describe("Filter by kid name"),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
  },
  async ({ kid, start_date, end_date }) => {
    const data = loadData();
    let filtered = data.activities;
    if (kid) filtered = filtered.filter((a) => a.kid === kid);
    if (start_date) filtered = filtered.filter((a) => a.date >= start_date);
    if (end_date) filtered = filtered.filter((a) => a.date <= end_date);

    if (filtered.length === 0) {
      return { content: [{ type: "text", text: "No activities found." }] };
    }
    const lines = filtered.map(
      (a) => `- ${a.date} | ${a.kid} | ${a.activity} (${a.subject}) | ${a.duration_minutes} min${a.notes ? " | " + a.notes : ""}`
    );
    return { content: [{ type: "text", text: `Activities (${filtered.length}):\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "list_lessons",
  "List lessons, optionally filtered by kid, subject, and/or date range",
  {
    kid: z.string().optional().describe("Filter by kid name"),
    subject: z.string().optional().describe("Filter by subject"),
    start_date: z.string().optional().describe("Start date (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("End date (YYYY-MM-DD)"),
  },
  async ({ kid, subject, start_date, end_date }) => {
    const data = loadData();
    let filtered = data.lessons;
    if (kid) filtered = filtered.filter((l) => l.kid === kid);
    if (subject) filtered = filtered.filter((l) => l.subject.toLowerCase() === subject.toLowerCase());
    if (start_date) filtered = filtered.filter((l) => l.date >= start_date);
    if (end_date) filtered = filtered.filter((l) => l.date <= end_date);

    if (filtered.length === 0) {
      return { content: [{ type: "text", text: "No lessons found." }] };
    }
    const lines = filtered.map(
      (l) => `- ${l.date} | ${l.kid} | ${l.subject}: ${l.topic} | ${l.duration_minutes} min${l.notes ? " | " + l.notes : ""}`
    );
    return { content: [{ type: "text", text: `Lessons (${filtered.length}):\n${lines.join("\n")}` }] };
  }
);

server.tool(
  "weekly_report",
  "Generate a weekly summary for a kid (or all kids) for the week containing the given date",
  {
    date: z.string().describe("Any date in the target week (YYYY-MM-DD)"),
    kid: z.string().optional().describe("Specific kid, or omit for all kids"),
  },
  async ({ date, kid }) => {
    const data = loadData();
    const { start, end } = getWeekBounds(date);
    const kids = kid ? [kid] : data.kids;

    if (kids.length === 0) {
      return { content: [{ type: "text", text: "No kids registered." }] };
    }

    const sections: string[] = [`Weekly Report: ${start} to ${end}`, ""];

    for (const k of kids) {
      const lessons = data.lessons.filter((l) => l.kid === k && l.date >= start && l.date <= end);
      const activities = data.activities.filter((a) => a.kid === k && a.date >= start && a.date <= end);

      const lessonMinutes = lessons.reduce((sum, l) => sum + l.duration_minutes, 0);
      const activityMinutes = activities.reduce((sum, a) => sum + a.duration_minutes, 0);
      const totalHours = ((lessonMinutes + activityMinutes) / 60).toFixed(1);

      const subjects = [...new Set([...lessons.map((l) => l.subject), ...activities.map((a) => a.subject)])];

      sections.push(`## ${k}`);
      sections.push(`- Total hours: ${totalHours}`);
      sections.push(`- Lessons: ${lessons.length}`);
      sections.push(`- Activities: ${activities.length}`);
      sections.push(`- Subjects: ${subjects.join(", ") || "None"}`);

      if (lessons.length > 0) {
        sections.push(`- Lesson details:`);
        for (const l of lessons) {
          sections.push(`  - ${l.date}: ${l.subject} — ${l.topic} (${l.duration_minutes} min)`);
        }
      }
      if (activities.length > 0) {
        sections.push(`- Activity details:`);
        for (const a of activities) {
          sections.push(`  - ${a.date}: ${a.activity} (${a.subject}, ${a.duration_minutes} min)`);
        }
      }
      sections.push("");
    }

    return { content: [{ type: "text", text: sections.join("\n") }] };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP server error:", err);
  process.exit(1);
});
