import { redirect } from "next/navigation";

/** Weekly Prep became the materials panel inside the planner. */
export default function PrepPage() {
  redirect("/week");
}
