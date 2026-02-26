"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import PlatformImportModal from "@/components/admin/PlatformImportModal";

type Child = { id: string; name: string };
type Subject = { id: string; name: string };

export default function PlatformImportCard({
  children,
  subjects,
  importAction,
}: {
  children: Child[];
  subjects: Subject[];
  importAction: (fd: FormData) => Promise<{ success?: boolean; imported?: number; error?: string }>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="w-full text-left">
        <Card className="cursor-pointer transition-shadow hover:shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔄</span>
            <div>
              <h3 className="text-lg font-semibold">Import Data</h3>
              <p className="text-sm text-muted">
                Import lessons or books from other platforms via CSV or JSON
              </p>
            </div>
          </div>
        </Card>
      </button>

      <PlatformImportModal
        open={open}
        onClose={() => setOpen(false)}
        children={children}
        subjects={subjects}
        onImport={importAction}
      />
    </>
  );
}
