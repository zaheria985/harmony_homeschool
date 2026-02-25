"use client";
import ReactMarkdown from "react-markdown";

export default function MarkdownContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div className={`prose prose-sm max-w-none ${className || ""}`}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
