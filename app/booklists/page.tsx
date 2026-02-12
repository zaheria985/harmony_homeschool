export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import BooklistsClient from "@/components/booklists/BooklistsClient";
import { ensureChildWishlist, getAllBooklists } from "@/lib/queries/booklists";
import { getAllBookResources } from "@/lib/queries/resources";
import { getCurrentUser } from "@/lib/session";
import { getChildById } from "@/lib/queries/students";
export default async function BooklistsPage() {
  const user = await getCurrentUser();
  if (user.role === "kid" && user.childId) {
    const child = await getChildById(user.childId);
    if (child?.name) {
      await ensureChildWishlist(user.childId, child.name);
    }
  }
  const [booklists, books] = await Promise.all([
    getAllBooklists(),
    getAllBookResources(),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="Booklists" />{" "}
      <BooklistsClient
        booklists={booklists}
        books={books}
        userRole={user.role}
        userChildId={user.childId || ""}
      />{" "}
    </div>
  );
}
