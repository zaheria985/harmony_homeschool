/**
 * Donut progress ring used by kid mode ("2/4 done") and student hubs.
 * Pure SVG so it works in a server component and needs no chart library.
 */

export default function ProgressRing({
  value,
  total,
  size = 56,
  stroke = 6,
  color = "var(--interactive)",
  label,
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  /** Ring color — pass a child's accent solid. */
  color?: string;
  /** Overrides the default "value/total" text in the middle. */
  label?: string;
}) {
  const safeTotal = total > 0 ? total : 0;
  const safeValue = Math.max(0, Math.min(value, safeTotal));
  const fraction = safeTotal === 0 ? 0 : safeValue / safeTotal;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * fraction;
  const text = label ?? `${safeValue}/${safeTotal}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${safeValue} of ${safeTotal} done`}
      className="shrink-0"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--surface-subtle)"
        strokeWidth={stroke}
      />
      {fraction > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference - filled}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      )}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.26}
        fontWeight="500"
        fill={color}
      >
        {text}
      </text>
    </svg>
  );
}
