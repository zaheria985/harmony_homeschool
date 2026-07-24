import { redirect } from "next/navigation";

/** Grades now live inside each student's hub, under the Grades tab. */
export default function GradesPage() {
  redirect("/students");
}
