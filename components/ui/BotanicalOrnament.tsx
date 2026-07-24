/**
 * Small hand-drawn botanical marks used sparingly across the app: empty
 * states, section dividers, and the kid "day finished" moment. Strokes use
 * `currentColor`, so color comes from the parent's text color.
 */

export type OrnamentVariant = "sprig" | "divider" | "seedling";

export default function BotanicalOrnament({
  variant = "sprig",
  size = 48,
  className = "",
}: {
  variant?: OrnamentVariant;
  size?: number;
  className?: string;
}) {
  if (variant === "divider") {
    return (
      <svg
        viewBox="0 0 120 12"
        width={size * 2.5}
        height={size / 4}
        aria-hidden="true"
        focusable="false"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      >
        <path d="M2 6h38" opacity="0.5" />
        <path d="M80 6h38" opacity="0.5" />
        <path d="M60 2v8" />
        <path d="M60 4c-3.2 0-5.4 1-6.4 2.6C55.2 8 57.4 8.4 60 7.2z" />
        <path d="M60 4c3.2 0 5.4 1 6.4 2.6C64.8 8 62.6 8.4 60 7.2z" />
      </svg>
    );
  }

  if (variant === "seedling") {
    return (
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        aria-hidden="true"
        focusable="false"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M24 42V22" />
        <path d="M24 26c-6 0-10.5-2.2-12.6-6.4C16 17.4 21 18.6 24 23z" />
        <path d="M24 22c6-1 10-4.4 11.2-9.6C29.4 12.8 25.4 15.8 24 21z" />
        <path d="M14 42h20" opacity="0.5" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M24 42C24 26 28 14 40 8" />
      <path d="M32 16c-4.4-1.4-8.4-.6-11 2.4 3 2.4 7 2.6 11-2.4z" />
      <path d="M35.6 24.4c-4.6-.4-8.4 1-10.4 4.4 3.4 1.6 7.4 1 10.4-4.4z" />
      <path d="M30 10.4c-3.6-2.6-7.6-3-10.8-1 2.2 3.2 6 4.4 10.8 1z" />
    </svg>
  );
}
