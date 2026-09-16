import { LeadsCalendar } from "@/components/admin/LeadsCalendar";

export const dynamic = "force-dynamic";

// Auth is enforced by the (dashboard) layout. The calendar itself is a client
// component so it can page between months and manage the add/edit modal.
export default function LeadsCalendarPage() {
  return <LeadsCalendar />;
}
