import { redirect } from "next/navigation";

// This deployment is the admin CRM. Send the root straight to it.
export default function Home() {
  redirect("/admin");
}
