"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { bulkCreateLessons, createCurriculum } from "@/lib/actions/lessons";
import { bulkCreateLessonResources } from "@/lib/actions/resources";
import { bulkCreateLessonCards } from "@/lib/actions/lesson-cards";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Curriculum = { id: string; name: string; subject_name: string };
type Subject = { id: string; name: string; color: string | null };
type Child = { id: string; name: string };
type SchoolYear = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
};

type Props = {
  curricula: Curriculum[];
  subjects: Subject[];
  children: Child[];
  schoolYears: SchoolYear[];
};

type TrelloBoard = {
  id: string;
  name: string;
  desc: string;
  url: string;
};
type TrelloList = { id: string; name: string; pos: number };
type TrelloAttachment = {
  id: string;
  name: string;
  url: string;
  mimeType: string | null;
};
type TrelloCheckItem = {
  name: string;
  state: "complete" | "incomplete";
};
type TrelloChecklist = {
  name: string;
  checkItems: TrelloCheckItem[];
};
type TrelloCard = {
  id: string;
  name: string;
  desc: string;
  due: string | null;
  dueComplete: boolean;
  pos: number;
  idList: string;
  attachments: TrelloAttachment[];
  checklists?: TrelloChecklist[];
};

type ExtractedResource = {
  type: "youtube" | "pdf" | "url";
  url: string;
  title: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
};

type LessonCardDraft = {
  trelloCardId: string;
  card_type: "checklist" | "youtube" | "url" | "note";
  title: string;
  content?: string;
  url?: string;
  include: boolean;
};

type LessonDraft = {
  cardId: string;
  include: boolean;
  title: string;
  description: string;
  planned_date: string | null;
  status: "planned" | "completed";
  section: string;
  resources: ExtractedResource[];
  lessonCards: LessonCardDraft[];
};

function buildLessonCardDrafts(listCards: TrelloCard[]): { lcDrafts: LessonCardDraft[]; resources: ExtractedResource[] } {
  const lcDrafts: LessonCardDraft[] = [];
  const allResources: ExtractedResource[] = [];

  for (const card of listCards) {
    const rawTitle = card.name;
    const checklists = card.checklists ?? [];
    const resources = extractResources(card);

    const titleIsUrl = /^https?:\/\/\S+$/i.test(rawTitle.trim());
    const titleUrl = titleIsUrl ? rawTitle.trim() : null;
    const isYouTube = titleUrl
      ? /youtube\.com|youtu\.be/.test(titleUrl)
      : resources.some((r) => r.type === "youtube");
    const youtubeUrl = titleUrl && isYouTube
      ? titleUrl
      : resources.find((r) => r.type === "youtube")?.url;

    if (isYouTube && youtubeUrl) {
      lcDrafts.push({
        trelloCardId: card.id,
        card_type: "youtube",
        title: titleIsUrl ? "" : rawTitle,
        url: youtubeUrl,
        include: true,
      });
    } else if (checklists.length > 0) {
      for (const cl of checklists) {
        const md = cl.checkItems.map((item) => {
          const checkbox = item.state === "complete" ? "- [x]" : "- [ ]";
          return `${checkbox} ${item.name}`;
        }).join("\n");
        lcDrafts.push({
          trelloCardId: `${card.id}-cl-${cl.name}`,
          card_type: "checklist",
          title: checklists.length > 1 ? cl.name : rawTitle,
          content: md,
          include: true,
        });
      }
    } else if (titleUrl) {
      lcDrafts.push({
        trelloCardId: card.id,
        card_type: "url",
        title: "",
        url: titleUrl,
        include: true,
      });
    } else {
      const baseDesc = cleanDescription(card.desc);
      lcDrafts.push({
        trelloCardId: card.id,
        card_type: "note",
        title: rawTitle,
        content: baseDesc || undefined,
        include: true,
      });
    }

    for (const r of resources) {
      const alreadyPrimary = isYouTube && r.type === "youtube" && r.url === youtubeUrl;
      if (alreadyPrimary) continue;
      if (r.type === "youtube") {
        lcDrafts.push({
          trelloCardId: `${card.id}-res-${r.url}`,
          card_type: "youtube",
          title: r.title,
          url: r.url,
          include: true,
        });
      }
    }

    allResources.push(...resources.filter((r) => r.type !== "youtube"));
  }

  return { lcDrafts, resources: allResources };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractResources(card: TrelloCard): ExtractedResource[] {
  const resources: ExtractedResource[] = [];

  for (const att of card.attachments) {
    // Uploaded files have a mimeType; link-only attachments don't
    const isFile = att.mimeType != null;

    if (/youtube\.com|youtu\.be/.test(att.url)) {
      resources.push({ type: "youtube", url: att.url, title: att.name });
    } else if (
      att.mimeType === "application/pdf" ||
      att.url.endsWith(".pdf")
    ) {
      resources.push({ type: "pdf", url: att.url, title: att.name, downloadUrl: isFile ? att.url : undefined });
    } else if (att.mimeType?.startsWith("image/") || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.url)) {
      resources.push({ type: "url", url: att.url, title: att.name, thumbnailUrl: att.url, downloadUrl: isFile ? att.url : undefined });
    } else if (att.url.startsWith("http")) {
      resources.push({ type: "url", url: att.url, title: att.name, downloadUrl: isFile ? att.url : undefined });
    }
  }

  const urlRegex = /https?:\/\/[^\s)>\]]+/g;
  const descUrls = (card.desc || "").match(urlRegex) || [];
  for (const url of descUrls) {
    if (resources.some((r) => r.url === url)) continue;
    if (/youtube\.com|youtu\.be/.test(url)) {
      resources.push({ type: "youtube", url, title: "YouTube Video" });
    } else if (url.endsWith(".pdf")) {
      resources.push({ type: "pdf", url, title: "PDF" });
    } else {
      resources.push({ type: "url", url, title: url.split("/").pop() || "Link" });
    }
  }

  return resources;
}

function cleanDescription(desc: string): string {
  return desc
    .replace(/https?:\/\/[^\s)>\]]+/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}


// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEP_LABELS = [
  "Select Board",
  "Configure",
  "Preview",
  "Import",
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <nav className="mb-6 flex items-center gap-2">
      {STEP_LABELS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === current;
        const isCompleted = stepNum < current;
        return (
          <div key={label} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-8 ${
                  isCompleted ? "bg-interactive" : "bg-border"
                }`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive
                    ? "bg-interactive text-white"
                    : isCompleted
                      ? "bg-interactive/20 text-interactive"
                      : "bg-muted text-muted"
                }`}
              >
                {isCompleted ? "\u2713" : stepNum}
              </span>
              <span
                className={`text-sm ${
                  isActive
                    ? "font-semibold text-primary"
                    : isCompleted
                      ? "text-secondary"
                      : "text-muted"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TrelloImportClient({
  curricula,
  subjects,
  children,
  schoolYears,
}: Props) {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState(1);

  // Step 1
  const [boards, setBoards] = useState<TrelloBoard[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(true);
  const [selectedBoardId, setSelectedBoardId] = useState("");

  // Step 2
  const [isNewCurriculum, setIsNewCurriculum] = useState(true);
  const [existingCurriculumId, setExistingCurriculumId] = useState("");
  const [newCurriculumName, setNewCurriculumName] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [schoolYearId, setSchoolYearId] = useState("");

  // Step 3
  const [lists, setLists] = useState<TrelloList[]>([]);
  const [cards, setCards] = useState<TrelloCard[]>([]);
  const [resourceListIds, setResourceListIds] = useState<Set<string>>(
    new Set()
  );
  const [lessonDrafts, setLessonDrafts] = useState<LessonDraft[]>([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Step 4
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    resources: number;
    lessonCards: number;
    curriculumId: string;
  } | null>(null);
  const [error, setError] = useState("");

  // -------------------------------------------------------------------------
  // Fetch boards on mount
  // -------------------------------------------------------------------------
  const fetchBoards = useCallback(async () => {
    setBoardsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trello?action=boards");
      if (!res.ok) throw new Error("Failed to fetch boards");
      const data = await res.json();
      setBoards(data.boards || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch boards");
    } finally {
      setBoardsLoading(false);
    }
  }, []);

  // Load boards when component mounts
  useEffect(() => {
    fetchBoards();
  }, [fetchBoards]);

  // -------------------------------------------------------------------------
  // Fetch board details (lists + cards)
  // -------------------------------------------------------------------------
  const fetchBoardDetails = useCallback(async () => {
    if (!selectedBoardId) return;
    setDetailsLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/trello?action=board-details&boardId=${selectedBoardId}`
      );
      if (!res.ok) throw new Error("Failed to fetch board details");
      const data = await res.json();
      const fetchedLists: TrelloList[] = data.lists || [];
      const fetchedCards: TrelloCard[] = data.cards || [];

      setLists(fetchedLists);
      setCards(fetchedCards);

      // Auto-detect resource lists
      const autoResourceIds = new Set<string>();
      for (const list of fetchedLists) {
        const lower = list.name.toLowerCase();
        if (lower === "resources" || lower === "credits") {
          autoResourceIds.add(list.id);
        }
      }
      setResourceListIds(autoResourceIds);

      // Build drafts
      const listMap = new Map(fetchedLists.map((l) => [l.id, l]));
      const sorted = [...fetchedCards].sort((a, b) => {
        const aList = listMap.get(a.idList);
        const bList = listMap.get(b.idList);
        const listDiff = (aList?.pos ?? 0) - (bList?.pos ?? 0);
        return listDiff !== 0 ? listDiff : a.pos - b.pos;
      });

      // Group cards by list — each list becomes a Lesson, each card becomes a Lesson Card
      const nonResourceCards = sorted.filter((c) => !autoResourceIds.has(c.idList));
      const cardsByList = new Map<string, TrelloCard[]>();
      for (const card of nonResourceCards) {
        const list = cardsByList.get(card.idList) || [];
        list.push(card);
        cardsByList.set(card.idList, list);
      }

      const drafts: LessonDraft[] = [];
      const nonResourceLists = fetchedLists.filter((l) => !autoResourceIds.has(l.id));

      for (const list of nonResourceLists) {
        const listCards = cardsByList.get(list.id) || [];
        if (listCards.length === 0) continue;
        const { lcDrafts, resources: cardResources } = buildLessonCardDrafts(listCards);

        drafts.push({
          cardId: list.id,
          include: true,
          title: list.name,
          description: "",
          planned_date: null,
          status: "planned",
          section: "",
          resources: cardResources,
          lessonCards: lcDrafts,
        });
      }

      setLessonDrafts(drafts);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch board details"
      );
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedBoardId]);

  // -------------------------------------------------------------------------
  // Rebuild drafts when resource lists change
  // -------------------------------------------------------------------------
  const rebuildDrafts = useCallback(
    (newResourceIds: Set<string>) => {
      const sorted = [...cards].sort((a, b) => {
        const aList = lists.find((l) => l.id === a.idList);
        const bList = lists.find((l) => l.id === b.idList);
        const listDiff = (aList?.pos ?? 0) - (bList?.pos ?? 0);
        return listDiff !== 0 ? listDiff : a.pos - b.pos;
      });

      const nonResourceCards = sorted.filter((c) => !newResourceIds.has(c.idList));
      const cardsByList = new Map<string, TrelloCard[]>();
      for (const card of nonResourceCards) {
        const arr = cardsByList.get(card.idList) || [];
        arr.push(card);
        cardsByList.set(card.idList, arr);
      }

      const drafts: LessonDraft[] = [];
      const nonResourceLists = lists.filter((l) => !newResourceIds.has(l.id));

      for (const list of nonResourceLists) {
        const listCards = cardsByList.get(list.id) || [];
        if (listCards.length === 0) continue;
        const existing = lessonDrafts.find((d) => d.cardId === list.id);
        const { lcDrafts, resources: cardResources } = buildLessonCardDrafts(listCards);

        drafts.push({
          cardId: list.id,
          include: existing?.include ?? true,
          title: list.name,
          description: "",
          planned_date: null,
          status: "planned",
          section: "",
          resources: cardResources,
          lessonCards: lcDrafts,
        });
      }

      setLessonDrafts(drafts);
    },
    [lists, cards, lessonDrafts]
  );

  // -------------------------------------------------------------------------
  // Toggle resource list
  // -------------------------------------------------------------------------
  const toggleResourceList = useCallback(
    (listId: string) => {
      const next = new Set(resourceListIds);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      setResourceListIds(next);
      rebuildDrafts(next);
    },
    [resourceListIds, rebuildDrafts]
  );

  // -------------------------------------------------------------------------
  // Toggle include on a draft
  // -------------------------------------------------------------------------
  const toggleDraftInclude = useCallback(
    (cardId: string) => {
      setLessonDrafts((prev) =>
        prev.map((d) =>
          d.cardId === cardId ? { ...d, include: !d.include } : d
        )
      );
    },
    []
  );

  // -------------------------------------------------------------------------
  // Toggle include on a lesson card draft
  // -------------------------------------------------------------------------
  const toggleLessonCardInclude = useCallback(
    (lessonCardId: string, lessonDraftId: string) => {
      setLessonDrafts((prev) =>
        prev.map((d) =>
          d.cardId === lessonDraftId
            ? {
                ...d,
                lessonCards: d.lessonCards.map((lc) =>
                  lc.trelloCardId === lessonCardId
                    ? { ...lc, include: !lc.include }
                    : lc
                ),
              }
            : d
        )
      );
    },
    []
  );

  // -------------------------------------------------------------------------
  // Toggle child selection
  // -------------------------------------------------------------------------
  const toggleChild = useCallback(
    (childId: string) => {
      setSelectedChildIds((prev) =>
        prev.includes(childId)
          ? prev.filter((id) => id !== childId)
          : [...prev, childId]
      );
    },
    []
  );

  // -------------------------------------------------------------------------
  // Step navigation
  // -------------------------------------------------------------------------
  const goToStep2 = useCallback(() => {
    if (!selectedBoardId) return;
    const board = boards.find((b) => b.id === selectedBoardId);
    if (board && !newCurriculumName) {
      setNewCurriculumName(board.name);
    }
    setStep(2);
  }, [selectedBoardId, boards, newCurriculumName]);

  const goToStep3 = useCallback(async () => {
    setStep(3);
    await fetchBoardDetails();
  }, [fetchBoardDetails]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(1, s - 1));
  }, []);

  // -------------------------------------------------------------------------
  // Import
  // -------------------------------------------------------------------------
  const doImport = useCallback(async () => {
    setImporting(true);
    setError("");

    try {
      let curriculumId: string;

      if (isNewCurriculum) {
        const fd = new FormData();
        fd.set("name", newCurriculumName);
        fd.set("subject_id", subjectId);
        if (selectedChildIds.length === 1) {
          fd.set("child_id", selectedChildIds[0]);
        }
        if (schoolYearId) {
          fd.set("school_year_id", schoolYearId);
        }
        const createResult = await createCurriculum(fd);
        if ("error" in createResult && createResult.error) {
          setError(createResult.error);
          setImporting(false);
          return;
        }
        curriculumId = (createResult as { id: string }).id;
      } else {
        curriculumId = existingCurriculumId;
      }

      // Build lesson data from included drafts
      const includedDrafts = lessonDrafts.filter((d) => d.include);
      if (includedDrafts.length === 0) {
        setError("No lessons selected for import");
        setImporting(false);
        return;
      }

      const lessonsPayload = includedDrafts.map((draft) => ({
        title: draft.title,
        curriculum_id: curriculumId,
        planned_date: draft.planned_date || undefined,
        description: draft.description || undefined,
        status: draft.status,
        section: draft.section || undefined,
      }));

      const bulkResult = await bulkCreateLessons(lessonsPayload, {
        childIds: selectedChildIds,
        schoolYearId: schoolYearId || undefined,
      });

      if ("error" in bulkResult && bulkResult.error) {
        setError(bulkResult.error);
        setImporting(false);
        return;
      }

      const lessonIds: string[] =
        "lessonIds" in bulkResult ? (bulkResult.lessonIds as string[]) : [];

      // Attach non-YouTube resources to created lessons
      let totalResources = 0;
      if (lessonIds.length > 0) {
        const resourceItems: Array<{
          lessonId: string;
          resources: ExtractedResource[];
        }> = [];

        for (let i = 0; i < includedDrafts.length; i++) {
          const draft = includedDrafts[i];
          if (draft.resources.length > 0 && lessonIds[i]) {
            resourceItems.push({
              lessonId: lessonIds[i],
              resources: draft.resources,
            });
            totalResources += draft.resources.length;
          }
        }

        if (resourceItems.length > 0) {
          const resResult = await bulkCreateLessonResources(resourceItems);
          if ("error" in resResult) {
            console.error("Failed to attach resources:", resResult.error);
          }
        }
      }

      // Create lesson cards for each lesson
      let totalLessonCards = 0;
      if (lessonIds.length > 0) {
        const lcItems: Array<{
          lessonId: string;
          cards: Array<{
            card_type: "checklist" | "youtube" | "url" | "resource" | "note";
            title?: string;
            content?: string;
            url?: string;
            thumbnail_url?: string;
          }>;
        }> = [];

        for (let i = 0; i < includedDrafts.length; i++) {
          const draft = includedDrafts[i];
          const includedCards = draft.lessonCards.filter((lc) => lc.include);
          if (includedCards.length > 0 && lessonIds[i]) {
            lcItems.push({
              lessonId: lessonIds[i],
              cards: includedCards.map((lc) => ({
                card_type: lc.card_type,
                title: lc.title || undefined,
                content: lc.content,
                url: lc.url,
              })),
            });
            totalLessonCards += includedCards.length;
          }
        }

        if (lcItems.length > 0) {
          const lcResult = await bulkCreateLessonCards(lcItems);
          if ("error" in lcResult) {
            console.error("Failed to create lesson cards:", lcResult.error);
          }
        }
      }

      setResult({
        created: bulkResult.created ?? 0,
        resources: totalResources,
        lessonCards: totalLessonCards,
        curriculumId,
      });
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }, [
    isNewCurriculum,
    newCurriculumName,
    subjectId,
    selectedChildIds,
    schoolYearId,
    existingCurriculumId,
    lessonDrafts,
  ]);

  // -------------------------------------------------------------------------
  // Validation helpers
  // -------------------------------------------------------------------------
  const step2Valid = isNewCurriculum
    ? newCurriculumName.trim() !== "" && subjectId !== ""
    : existingCurriculumId !== "";


  // -------------------------------------------------------------------------
  // Computed preview stats
  // -------------------------------------------------------------------------
  const includedCount = lessonDrafts.filter((d) => d.include).length;
  const totalLessonCardCount = lessonDrafts
    .filter((d) => d.include)
    .reduce((sum, d) => sum + d.lessonCards.filter((lc) => lc.include).length, 0);
  const totalResourceCount = lessonDrafts
    .filter((d) => d.include)
    .reduce((sum, d) => sum + d.resources.length, 0);
  const resourceOnlyCards = cards.filter((c) => resourceListIds.has(c.idList));

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div>
      <StepIndicator current={step} />

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 1: Select Board                                              */}
      {/* ================================================================= */}
      {step === 1 && (
        <div className="space-y-4">
          <p className="text-sm text-secondary">
            Choose a Trello board to import lessons from.
          </p>

          {boardsLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-interactive border-t-transparent" />
              Loading boards...
            </div>
          ) : boards.length === 0 ? (
            <p className="py-8 text-sm text-muted">
              No boards found. Make sure your Trello token has access to at
              least one board.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {boards.map((board) => (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => setSelectedBoardId(board.id)}
                  className={`rounded-2xl border p-5 text-left shadow-warm transition-colors ${
                    selectedBoardId === board.id
                      ? "border-interactive bg-interactive/5 ring-2 ring-focus"
                      : "border-light bg-surface hover:border-interactive/50"
                  }`}
                >
                  <p className="font-medium text-primary">{board.name}</p>
                  {board.desc && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted">
                      {board.desc}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              disabled={!selectedBoardId}
              onClick={goToStep2}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: Configure Import                                          */}
      {/* ================================================================= */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Curriculum mode */}
          <Card title="Curriculum">
            <div className="space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="radio"
                    name="currMode"
                    checked={isNewCurriculum}
                    onChange={() => setIsNewCurriculum(true)}
                    className="accent-interactive"
                  />
                  Create new curriculum
                </label>
                <label className="flex items-center gap-2 text-sm text-primary">
                  <input
                    type="radio"
                    name="currMode"
                    checked={!isNewCurriculum}
                    onChange={() => setIsNewCurriculum(false)}
                    className="accent-interactive"
                  />
                  Add to existing curriculum
                </label>
              </div>

              {isNewCurriculum ? (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary">
                      Curriculum Name
                    </label>
                    <input
                      type="text"
                      value={newCurriculumName}
                      onChange={(e) => setNewCurriculumName(e.target.value)}
                      placeholder="e.g. Ancient History"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-focus"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-secondary">
                      Subject
                    </label>
                    <select
                      value={subjectId}
                      onChange={(e) => setSubjectId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
                    >
                      <option value="">Select a subject...</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-sm font-medium text-secondary">
                    Existing Curriculum
                  </label>
                  <select
                    value={existingCurriculumId}
                    onChange={(e) => setExistingCurriculumId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
                  >
                    <option value="">Select a curriculum...</option>
                    {curricula.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.subject_name} &mdash; {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </Card>

          {/* Children */}
          <Card title="Assign to Children">
            <div className="space-y-2">
              <p className="text-sm text-muted">
                Select the children who will use this curriculum.
              </p>
              <div className="flex flex-wrap gap-2">
                {children.map((child) => (
                  <label
                    key={child.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      selectedChildIds.includes(child.id)
                        ? "border-interactive bg-interactive/10 text-primary"
                        : "border-border bg-surface text-secondary hover:border-interactive/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedChildIds.includes(child.id)}
                      onChange={() => toggleChild(child.id)}
                      className="accent-interactive"
                    />
                    {child.name}
                  </label>
                ))}
              </div>
            </div>
          </Card>

          {/* School year */}
          <Card title="School Year">
            <div>
              <p className="mb-2 text-sm text-muted">
                Assign lessons to a school year.
              </p>
              <select
                value={schoolYearId}
                onChange={(e) => setSchoolYearId(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
              >
                <option value="">None</option>
                {schoolYears.map((sy) => (
                  <option key={sy.id} value={sy.id}>
                    {sy.label} ({sy.start_date} to {sy.end_date})
                  </option>
                ))}
              </select>
            </div>
          </Card>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-muted/30"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!step2Valid}
              onClick={goToStep3}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: Preview                                                   */}
      {/* ================================================================= */}
      {step === 3 && (
        <div className="space-y-4">
          {detailsLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-interactive border-t-transparent" />
              Fetching board data...
            </div>
          ) : (
            <>
              {/* Summary bar */}
              <div className="rounded-2xl border border-light bg-surface p-4 shadow-warm">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="font-semibold text-primary">
                    {includedCount} lesson{includedCount !== 1 ? "s" : ""}
                  </span>
                  <span className="text-muted">with</span>
                  <span className="font-semibold text-primary">
                    {totalLessonCardCount} lesson card
                    {totalLessonCardCount !== 1 ? "s" : ""}
                  </span>
                  {totalResourceCount > 0 && (
                    <>
                      <span className="text-muted">+</span>
                      <span className="font-semibold text-primary">
                        {totalResourceCount} resource
                        {totalResourceCount !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                  {resourceOnlyCards.length > 0 && (
                    <>
                      <span className="text-muted">|</span>
                      <span className="text-secondary">
                        {resourceOnlyCards.length} skipped card
                        {resourceOnlyCards.length !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Resource list selectors */}
              {lists.length > 0 && (
                <Card title="Mark Lists as Resources-Only (skip import)">
                  <div className="flex flex-wrap gap-2">
                    {lists.map((list) => (
                      <label
                        key={list.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          resourceListIds.has(list.id)
                            ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-600 dark:bg-amber-900/20 dark:text-amber-300"
                            : "border-border bg-surface text-secondary hover:border-interactive/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={resourceListIds.has(list.id)}
                          onChange={() => toggleResourceList(list.id)}
                          className="accent-interactive"
                        />
                        {list.name}
                        <span className="text-xs text-muted">
                          (
                          {cards.filter((c) => c.idList === list.id).length}{" "}
                          cards)
                        </span>
                      </label>
                    ))}
                  </div>
                </Card>
              )}

              {/* Lessons (from Trello lists) with their lesson cards */}
              {lessonDrafts.map((draft) => {
                const includedCardCount = draft.lessonCards.filter(
                  (lc) => lc.include
                ).length;

                return (
                  <div
                    key={draft.cardId}
                    className={`rounded-2xl border shadow-warm ${
                      draft.include
                        ? "border-light bg-surface"
                        : "border-border bg-muted/20 opacity-60"
                    }`}
                  >
                    {/* Lesson header */}
                    <div className="flex items-center gap-3 border-b border-light px-4 py-3">
                      <input
                        type="checkbox"
                        checked={draft.include}
                        onChange={() => toggleDraftInclude(draft.cardId)}
                        className="accent-interactive"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-primary">
                          {draft.title}
                        </h3>
                        <p className="text-xs text-muted">
                          Trello list &rarr; Lesson &middot;{" "}
                          {includedCardCount} card
                          {includedCardCount !== 1 ? "s" : ""}
                          {draft.resources.length > 0 && (
                            <span>
                              {" "}
                              &middot; {draft.resources.length} resource
                              {draft.resources.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Lesson cards list */}
                    {draft.include && draft.lessonCards.length > 0 && (
                      <div className="divide-y divide-border/50">
                        {draft.lessonCards.map((lc) => (
                          <div
                            key={lc.trelloCardId}
                            className={`flex items-start gap-3 px-4 py-2.5 ${
                              lc.include ? "" : "opacity-40"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={lc.include}
                              onChange={() =>
                                toggleLessonCardInclude(
                                  lc.trelloCardId,
                                  draft.cardId
                                )
                              }
                              className="mt-0.5 accent-interactive"
                            />
                            <Badge
                              variant={
                                lc.card_type === "youtube"
                                  ? "danger"
                                  : lc.card_type === "checklist"
                                    ? "info"
                                    : lc.card_type === "url"
                                      ? "default"
                                      : "default"
                              }
                            >
                              {lc.card_type}
                            </Badge>
                            <div className="flex-1 min-w-0">
                              <p className="truncate text-sm text-primary">
                                {lc.title || lc.url || "Untitled"}
                              </p>
                              {lc.content && (
                                <p className="mt-0.5 truncate text-xs text-muted">
                                  {lc.content.slice(0, 100)}
                                  {lc.content.length > 100 ? "..." : ""}
                                </p>
                              )}
                              {lc.url && lc.title && (
                                <p className="mt-0.5 truncate text-xs text-muted">
                                  {lc.url}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Resource-only lists summary */}
              {resourceOnlyCards.length > 0 && (
                <div className="rounded-2xl border border-light bg-surface p-4 shadow-warm">
                  <p className="text-sm text-secondary">
                    <span className="font-semibold">
                      {resourceOnlyCards.length}
                    </span>{" "}
                    card{resourceOnlyCards.length !== 1 ? "s" : ""} from
                    resource-only lists will be skipped.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-muted/30"
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                detailsLoading ||
                includedCount === 0 ||
                importing
              }
              onClick={doImport}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {importing ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Importing...
                </span>
              ) : (
                `Import ${includedCount} Lesson${includedCount !== 1 ? "s" : ""}`
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 4: Results                                                   */}
      {/* ================================================================= */}
      {step === 4 && result && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-green-300 bg-green-50 p-6 text-center shadow-warm dark:border-green-700 dark:bg-green-900/20">
            <div className="mb-2 text-3xl">&#10003;</div>
            <h2 className="text-lg font-semibold text-primary">
              Import Complete
            </h2>
            <p className="mt-2 text-sm text-secondary">
              Created{" "}
              <span className="font-semibold">
                {result.created} lesson{result.created !== 1 ? "s" : ""}
              </span>
              {result.lessonCards > 0 && (
                <>
                  {" "}
                  with{" "}
                  <span className="font-semibold">
                    {result.lessonCards} lesson card
                    {result.lessonCards !== 1 ? "s" : ""}
                  </span>
                </>
              )}
              {result.resources > 0 && (
                <>
                  {" "}
                  and{" "}
                  <span className="font-semibold">
                    {result.resources} resource
                    {result.resources !== 1 ? "s" : ""}
                  </span>
                </>
              )}
              .
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/curricula/${result.curriculumId}`)}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
            >
              View Curriculum
            </button>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setResult(null);
                setLessonDrafts([]);
                setLists([]);
                setCards([]);
                setResourceListIds(new Set());
                setSelectedBoardId("");
                setError("");
              }}
              className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-muted/30"
            >
              Import Another Board
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
