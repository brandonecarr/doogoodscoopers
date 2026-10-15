import { notFound } from "next/navigation";
import DesignerDevClient from "./DesignerDevClient";

/** Development-only harness for the email designer (404 in production). */
export const dynamic = "force-dynamic";

export default function DesignerDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DesignerDevClient />;
}
