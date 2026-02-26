export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import BooklistsClient from "@/components/booklists/BooklistsClient";
import { ensureChildWishlist, getAllBooklists } from "@/lib/queries/booklists";
import { getAllBookResources } from "@/lib/queries/resources";
import { getCurrentUser } from "@/lib/session";
import { getChildById } from "@/lib/queries/students";
import BooklistExportButton from "@/components/booklists/BooklistExportButton";
import BookRecommendations from "@/components/booklists/BookRecommendations";
import { getBookRecommendations } from "@/lib/queries/booklists";
export default async function BooklistsPage() {
  const user = await getCurrentUser();
  if (user.role === "kid" && user.childId) {
    const child = await getChildById(user.childId);
    if (child?.name) {
      await ensureChildWishlist(user.childId, child.name);
    }
  }
  const [booklists, books, recommendations] = await Promise.all([
    getAllBooklists(),
    getAllBookResources(),
    getBookRecommendations(user.role === "kid" ? user.childId || undefined : undefined),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="Booklists">
        <BooklistExportButton />
      </PageHeader>{" "}
      <BookRecommendations recommendations={recommendations} />
      <BooklistsClient
        booklists={booklists}
        books={books}
        userRole={user.role}
        userChildId={user.childId || ""}
        permissionLevel={user.permissionLevel}
      />{" "}
    </div>
  );
}
