"use client";
import { useMemo, useState, useTransition } from "react";
import EmptyState from "@/components/ui/EmptyState";
import Modal from "@/components/ui/Modal";
import BookCard from "@/components/booklists/BookCard";
import {
  addBookToPersonalWishlist,
  addBookToBooklist,
  createBooklist,
  createBooklistFromTags,
  deleteBooklist,
  updateBooklist,
} from "@/lib/actions/booklists";
import { createGlobalResource } from "@/lib/actions/resources";
import { useRouter } from "next/navigation";
type BookResource = {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
  tags: string[];
};
type Booklist = {
  id: string;
  name: string;
  owner_child_id: string | null;
  description: string | null;
  created_at: string;
  books: (BookResource & { booklist_id: string; position: number })[];
};
export default function BooklistsClient({
  booklists,
  books,
  userRole,
  userChildId,
}: {
  booklists: Booklist[];
  books: BookResource[];
  userRole: string;
  userChildId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [draggingBookId, setDraggingBookId] = useState<string | null>(null);
  const [dragOverListId, setDragOverListId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [editing, setEditing] = useState<Booklist | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [createMode, setCreateMode] = useState<"manual" | "tags">("manual");
  const [search, setSearch] = useState("");
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [kidTitle, setKidTitle] = useState("");
  const [kidAuthor, setKidAuthor] = useState("");
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [bookDescription, setBookDescription] = useState("");
  const [booklistTargets, setBooklistTargets] = useState<string[]>([]);
  const fieldClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus";
  const isKid = userRole === "kid";
  const personalBooklist =
    booklists.find((list) => list.owner_child_id === userChildId) || null;
  const unassignedBooks = useMemo(() => {
    const assignedIds = new Set<string>();
    for (const list of booklists) {
      for (const book of list.books) {
        assignedIds.add(book.id);
      }
    }
    return books.filter((b) => !assignedIds.has(b.id));
  }, [booklists, books]);
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const book of books) {
      for (const tag of book.tags || []) tags.add(tag);
    }
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [books]);
  const filteredBooks = books.filter((book) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      book.title.toLowerCase().includes(q) ||
      (book.author || "").toLowerCase().includes(q)
    );
  });
  const matchingBooksFromTags = useMemo(() => {
    if (selectedTags.length === 0) return [];
    return books.filter((book) =>
      book.tags?.some((tag) => selectedTags.includes(tag)),
    );
  }, [books, selectedTags]);
  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setCreateMode("manual");
    setSearch("");
    setSelectedBookIds([]);
    setSelectedTags([]);
    setError("");
    setShowModal(true);
  }
  function openAddBook() {
    setBookTitle("");
    setBookAuthor("");
    setBookDescription("");
    setBooklistTargets([]);
    setError("");
    setShowAddBookModal(true);
  }
  function openEdit(list: Booklist) {
    setEditing(list);
    setName(list.name);
    setDescription(list.description || "");
    setSearch("");
    setSelectedBookIds(list.books.map((book) => book.id));
    setError("");
    setShowModal(true);
  }
  function toggleBook(id: string) {
    setSelectedBookIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
  }
  function toggleBooklistTarget(id: string) {
    setBooklistTargets((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", name);
      formData.set("description", description);
      for (const resourceId of selectedBookIds) {
        formData.append("resource_ids", resourceId);
      }
      if (editing) {
        formData.set("id", editing.id);
        const updated = await updateBooklist(formData);
        if ("error" in updated) {
          setError(updated.error || "Failed to save booklist");
          return;
        }
      } else {
        if (createMode === "tags") {
          const createdFromTags = await createBooklistFromTags(
            name,
            selectedTags,
            description,
          );
          if ("error" in createdFromTags) {
            setError(createdFromTags.error || "Failed to save booklist");
            return;
          }
        } else {
          const created = await createBooklist(formData);
          if ("error" in created) {
            setError(created.error || "Failed to save booklist");
            return;
          }
        }
      }
      setShowModal(false);
      router.refresh();
    });
  }
  function handleDelete(id: string) {
    if (!confirm("Delete this booklist?")) return;
    startTransition(async () => {
      const result = await deleteBooklist(id);
      if ("error" in result) {
        setError(result.error || "Failed to delete booklist");
        return;
      }
      router.refresh();
    });
  }
  function handleDrop(listId: string) {
    if (!draggingBookId) return;
    if (isKid && (!personalBooklist || listId !== personalBooklist.id)) {
      setError("You can only add books to your own wishlist.");
      setDragOverListId(null);
      setDraggingBookId(null);
      return;
    }
    startTransition(async () => {
      const result = await addBookToBooklist(listId, draggingBookId);
      setDragOverListId(null);
      setDraggingBookId(null);
      if ("error" in result) {
        setError(result.error || "Failed to move book");
        return;
      }
      router.refresh();
    });
  }
  function handleKidAddBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await addBookToPersonalWishlist(kidTitle, kidAuthor);
      if ("error" in result) {
        setError(result.error || "Failed to add book");
        return;
      }
      setKidTitle("");
      setKidAuthor("");
      router.refresh();
    });
  }
  function handleAddBook(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!bookTitle.trim()) {
      setError("Book title is required.");
      return;
    }
    // Booklist selection is now optional - books can be unassigned
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("title", bookTitle.trim());
      formData.set("type", "book");
      formData.set("author", bookAuthor.trim());
      formData.set("description", bookDescription.trim());
      for (const listId of booklistTargets) {
        formData.append("booklist_ids", listId);
      }
      const result = await createGlobalResource(formData);
      if ("error" in result) {
        setError(result.error || "Failed to add book");
        return;
      }
      setShowAddBookModal(false);
      router.refresh();
    });
  }
  return (
    <>
      {" "}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {" "}
        <p className="text-sm text-muted">
          Drag books between booklists and build lists from tags.
        </p>{" "}
        {!isKid && (
          <div className="flex gap-2">
            {" "}
            <button
              onClick={openCreate}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
            >
              {" "}
              + New Booklist{" "}
            </button>{" "}
            <button
              onClick={openAddBook}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted"
            >
              {" "}
              + Add Book{" "}
            </button>{" "}
          </div>
        )}{" "}
      </div>{" "}
      {isKid && (
        <form
          onSubmit={handleKidAddBook}
          className="mb-4 rounded-xl border border-light bg-surface p-3"
        >
          {" "}
          <p className="mb-2 text-sm font-semibold text-secondary">
            Add to your wishlist
          </p>{" "}
          <div className="grid gap-2 sm:grid-cols-3">
            {" "}
            <input
              value={kidTitle}
              onChange={(e) => setKidTitle(e.target.value)}
              placeholder="Book title"
              required
              className={fieldClass}
            />{" "}
            <input
              value={kidAuthor}
              onChange={(e) => setKidAuthor(e.target.value)}
              placeholder="Author"
              required
              className={fieldClass}
            />{" "}
            <button
              type="submit"
              disabled={isPending || !personalBooklist}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              Add Book{" "}
            </button>{" "}
          </div>{" "}
          {!personalBooklist && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
              Your personal wishlist is not available yet.
            </p>
          )}{" "}
        </form>
      )}{" "}
      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}{" "}
      {booklists.length === 0 ? (
        <EmptyState
          icon="📚"
          message="No booklists yet. Create one and add books from your resource library."
        />
      ) : (
        <div className="overflow-x-auto pb-2">
          {" "}
          <div className="grid auto-cols-[minmax(16rem,1fr)] grid-flow-col gap-3">
            {" "}
            {booklists.map((list) => (
              <section
                key={list.id}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverListId(list.id);
                }}
                onDragLeave={() =>
                  setDragOverListId((current) =>
                    current === list.id ? null : current,
                  )
                }
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(list.id);
                }}
                className={`min-h-[20rem] rounded-xl border p-3 transition-colors ${dragOverListId === list.id ? "border-interactive-border bg-interactive-light/70/20" : "border-light bg-surface-muted/60/40"}`}
              >
                {" "}
                <div className="mb-3 flex items-start justify-between gap-2 border-b border-light pb-2">
                  {" "}
                  <div>
                    {" "}
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                      {list.name}
                    </h2>{" "}
                    <p className="text-xs text-muted">
                      {" "}
                      {list.books.length}{" "}
                      {list.books.length === 1 ? "book" : "books"}{" "}
                    </p>{" "}
                  </div>{" "}
                  {!isKid && (
                    <div className="flex gap-1">
                      {" "}
                      <button
                        onClick={() => openEdit(list)}
                        aria-label={`Edit booklist ${list.name}`}
                        className="rounded border px-2 py-1 text-xs text-tertiary hover:bg-surface-muted"
                      >
                        {" "}
                        Edit{" "}
                      </button>{" "}
                      <button
                        onClick={() => handleDelete(list.id)}
                        aria-label={`Delete booklist ${list.name}`}
                        className="rounded border border-[var(--error-border)] px-2 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)] dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/30"
                      >
                        {" "}
                        Delete{" "}
                      </button>{" "}
                    </div>
                  )}{" "}
                </div>{" "}
                {list.description && (
                  <p className="mb-3 line-clamp-2 text-sm text-tertiary">
                    {list.description}
                  </p>
                )}{" "}
                {list.books.length === 0 ? (
                  <p className="text-sm text-muted">
                    Drop a book here or edit this list to add books.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {" "}
                    {list.books.map((book) => (
                      <BookCard
                        key={`${list.id}-${book.id}`}
                        book={book}
                        draggable
                        onDragStart={(bookId) => setDraggingBookId(bookId)}
                      />
                    ))}{" "}
                  </div>
                )}{" "}
              </section>
            ))}{" "}
          </div>{" "}
        </div>
      )}{" "}
      {unassignedBooks.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-secondary">
            Unassigned Books
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {unassignedBooks.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                draggable
                onDragStart={(bookId) => setDraggingBookId(bookId)}
              />
            ))}
          </div>
        </div>
      )}
      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? "Edit Booklist" : "New Booklist"}
      >
        {" "}
        <form onSubmit={handleSubmit} className="space-y-4">
          {" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Name
            </label>{" "}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              placeholder="Morning Basket Ages 8-10"
              required
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Description
            </label>{" "}
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className={fieldClass}
            />{" "}
          </div>{" "}
          {!editing && (
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                How to add books
              </label>{" "}
              <div className="space-y-1 rounded-lg border border-light p-2">
                {" "}
                <label className="flex items-center gap-2 text-sm text-secondary">
                  {" "}
                  <input
                    type="radio"
                    name="create_mode"
                    checked={createMode === "manual"}
                    onChange={() => setCreateMode("manual")}
                  />{" "}
                  Select books manually{" "}
                </label>{" "}
                <label className="flex items-center gap-2 text-sm text-secondary">
                  {" "}
                  <input
                    type="radio"
                    name="create_mode"
                    checked={createMode === "tags"}
                    onChange={() => setCreateMode("tags")}
                  />{" "}
                  Create from tags{" "}
                </label>{" "}
              </div>{" "}
            </div>
          )}{" "}
          {(editing || createMode === "manual") && (
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Books
              </label>{" "}
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search books..."
                className={`mb-2 ${fieldClass}`}
              />{" "}
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-light p-2">
                {" "}
                {filteredBooks.length === 0 ? (
                  <p className="py-4 text-center text-sm text-muted">
                    No books found.
                  </p>
                ) : (
                  filteredBooks.map((book) => (
                    <label
                      key={book.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-muted"
                    >
                      {" "}
                      <input
                        type="checkbox"
                        checked={selectedBookIds.includes(book.id)}
                        onChange={() => toggleBook(book.id)}
                      />{" "}
                      <div className="min-w-0 flex-1">
                        {" "}
                        <p className="truncate text-sm text-primary">
                          {book.title}
                        </p>{" "}
                        {book.author && (
                          <p className="truncate text-xs text-muted">
                            {book.author}
                          </p>
                        )}{" "}
                      </div>{" "}
                    </label>
                  ))
                )}{" "}
              </div>{" "}
              <p className="mt-1 text-xs text-muted">
                {selectedBookIds.length} selected
              </p>{" "}
            </div>
          )}{" "}
          {!editing && createMode === "tags" && (
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                Tags
              </label>{" "}
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-light p-2">
                {" "}
                {allTags.length === 0 ? (
                  <p className="text-sm text-muted">
                    No tags available yet.
                  </p>
                ) : (
                  allTags.map((tag) => (
                    <label
                      key={tag}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-surface-muted"
                    >
                      {" "}
                      <input
                        type="checkbox"
                        checked={selectedTags.includes(tag)}
                        onChange={() => toggleTag(tag)}
                      />{" "}
                      <span className="text-sm text-primary">{tag}</span>{" "}
                    </label>
                  ))
                )}{" "}
              </div>{" "}
              <p className="mt-1 text-xs text-muted">
                {matchingBooksFromTags.length} books will be copied into this
                list
              </p>{" "}
            </div>
          )}{" "}
          <div className="flex justify-end gap-2">
            {" "}
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              {" "}
              Cancel{" "}
            </button>{" "}
            <button
              type="submit"
              disabled={
                isPending ||
                (!editing && createMode === "tags" && selectedTags.length === 0)
              }
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              {isPending
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : createMode === "tags"
                    ? "Create from Tags"
                    : "Create Booklist"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </Modal>{" "}
      <Modal
        open={showAddBookModal}
        onClose={() => setShowAddBookModal(false)}
        title="Add Book"
      >
        {" "}
        <form onSubmit={handleAddBook} className="space-y-4">
          {" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Title
            </label>{" "}
            <input
              value={bookTitle}
              onChange={(e) => setBookTitle(e.target.value)}
              className={fieldClass}
              required
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Author
            </label>{" "}
            <input
              value={bookAuthor}
              onChange={(e) => setBookAuthor(e.target.value)}
              className={fieldClass}
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Notes
            </label>{" "}
            <textarea
              value={bookDescription}
              onChange={(e) => setBookDescription(e.target.value)}
              rows={2}
              className={fieldClass}
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Add to booklists <span className="text-muted">(optional)</span>
            </label>{" "}
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-light p-2">
              {" "}
              {booklists.map((list) => (
                <label
                  key={list.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-secondary hover:bg-surface-muted"
                >
                  {" "}
                  <input
                    type="checkbox"
                    checked={booklistTargets.includes(list.id)}
                    onChange={() => toggleBooklistTarget(list.id)}
                  />{" "}
                  <span>{list.name}</span>{" "}
                </label>
              ))}{" "}
            </div>{" "}
          </div>{" "}
          <div className="flex justify-end gap-2">
            {" "}
            <button
              type="button"
              onClick={() => setShowAddBookModal(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              {" "}
              Cancel{" "}
            </button>{" "}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              {isPending ? "Adding..." : "Add Book"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </Modal>{" "}
    </>
  );
}
