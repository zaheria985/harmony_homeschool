"use client";

import { useState } from "react";

interface GradeTrendPoint {
  date: string;
  grade: number;
  lesson_title: string;
}

interface SubjectTrend {
  subject_name: string;
  subject_color: string;
  child_name: string;
  child_id: string;
  grades: GradeTrendPoint[];
}

interface Props {
  trends: SubjectTrend[];
  children: { id: string; name: string }[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function GradeColor(grade: number): string {
  if (grade >= 90) return "text-green-600 dark:text-green-400";
  if (grade >= 80) return "text-blue-600 dark:text-blue-400";
  if (grade >= 70) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

interface TooltipData {
  lesson_title: string;
  grade: number;
  date: string;
  x: number;
  y: number;
}

function SubjectSparkline({
  trend,
}: {
  trend: SubjectTrend;
}) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const points = trend.grades;
  if (points.length === 0) return null;

  const chartHeight = 120;
  const chartWidth = 600;
  const paddingX = 10;
  const paddingY = 10;
  const usableWidth = chartWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingY * 2;

  // Map grades to SVG coordinates
  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? chartWidth / 2
        : paddingX + (i / (points.length - 1)) * usableWidth;
    const y = paddingY + usableHeight - (p.grade / 100) * usableHeight;
    return { x, y, ...p };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");

  return (
    <div className="rounded-lg border border-light bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full"
          style={{ backgroundColor: trend.subject_color || "#6b7280" }}
        />
        <span className="text-sm font-medium text-primary">
          {trend.subject_name}
        </span>
        <span className="text-xs text-muted">
          {points.length} grade{points.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 flex h-full w-8 flex-col justify-between py-[10px] text-right text-[10px] text-muted">
          <span>100</span>
          <span>50</span>
          <span>0</span>
        </div>

        <div className="ml-9">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full"
            style={{ maxHeight: `${chartHeight}px` }}
            preserveAspectRatio="none"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((val) => {
              const y = paddingY + usableHeight - (val / 100) * usableHeight;
              return (
                <line
                  key={val}
                  x1={paddingX}
                  y1={y}
                  x2={chartWidth - paddingX}
                  y2={y}
                  stroke="currentColor"
                  className="text-muted/20"
                  strokeWidth="0.5"
                  strokeDasharray={val === 0 || val === 100 ? "0" : "4 4"}
                />
              );
            })}

            {/* Trend line */}
            {coords.length > 1 && (
              <polyline
                points={polylinePoints}
                fill="none"
                stroke={trend.subject_color || "#6b7280"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Data points */}
            {coords.map((c, i) => (
              <circle
                key={i}
                cx={c.x}
                cy={c.y}
                r="4"
                fill={trend.subject_color || "#6b7280"}
                stroke="white"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
                className="cursor-pointer"
                onMouseEnter={(e) => {
                  const rect = (
                    e.currentTarget.closest("svg") as SVGSVGElement
                  ).getBoundingClientRect();
                  const svgX = c.x / chartWidth;
                  const svgY = c.y / chartHeight;
                  setTooltip({
                    lesson_title: c.lesson_title,
                    grade: c.grade,
                    date: c.date,
                    x: svgX * rect.width,
                    y: svgY * rect.height,
                  });
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            ))}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="pointer-events-none absolute z-10 rounded-md border border-light bg-surface px-3 py-2 shadow-lg"
              style={{
                left: `${Math.min(tooltip.x, 280)}px`,
                top: `${tooltip.y - 60}px`,
              }}
            >
              <div className="text-xs font-medium text-primary">
                {tooltip.lesson_title}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs">
                <span className={`font-semibold ${GradeColor(tooltip.grade)}`}>
                  {tooltip.grade.toFixed(1)}
                </span>
                <span className="text-muted">{formatDate(tooltip.date)}</span>
              </div>
            </div>
          )}

          {/* X-axis date labels */}
          {points.length > 1 && (
            <div className="mt-1 flex justify-between text-[10px] text-muted">
              <span>{formatDate(points[0].date)}</span>
              {points.length > 2 && (
                <span>
                  {formatDate(points[Math.floor(points.length / 2)].date)}
                </span>
              )}
              <span>{formatDate(points[points.length - 1].date)}</span>
            </div>
          )}
          {points.length === 1 && (
            <div className="mt-1 text-center text-[10px] text-muted">
              {formatDate(points[0].date)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GradeTrendsChart({ trends, children }: Props) {
  const [selectedChild, setSelectedChild] = useState<string>("all");

  const filtered =
    selectedChild === "all"
      ? trends
      : trends.filter((t) => t.child_id === selectedChild);

  // Group by child
  const grouped = new Map<string, SubjectTrend[]>();
  for (const t of filtered) {
    const key = t.child_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(t);
  }

  return (
    <div>
      {/* Child filter */}
      {children.length > 1 && (
        <div className="mb-4 flex items-center gap-2">
          <label className="text-sm text-muted">Student:</label>
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="rounded-md border border-light bg-surface px-3 py-1.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <option value="all">All Students</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No graded lessons to chart yet. Grades will appear here once lessons
          are completed with numeric grades.
        </p>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([childName, childTrends]) => (
            <div key={childName}>
              {(selectedChild === "all" && children.length > 1) && (
                <h3 className="mb-3 text-sm font-semibold text-primary">
                  {childName}
                </h3>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {childTrends.map((trend) => (
                  <SubjectSparkline
                    key={`${trend.child_id}-${trend.subject_name}`}
                    trend={trend}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
