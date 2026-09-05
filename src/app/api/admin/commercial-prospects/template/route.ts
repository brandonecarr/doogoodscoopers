import { getSession } from "@/lib/auth";

/** CSV template for the call-list upload. Column names are matched loosely, so close variants work too. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const csv = ["property,type,contact,phone,email,address,city,state,zip,units,notes,source",
    "Sierra Lakes HOA,HOA,Board manager name,(909) 555-0100,manager@example.com,16000 Sierra Lakes Pkwy,Fontana,CA,92336,240,Allows dogs; pet stations on site,hoa-directory.example",
    "The Reserve Apartments,Apartments,Leasing office,,leasing@example.com,,Rancho Cucamonga,CA,91739,180,Dog park on property,",
    "Solera at Apple Valley,55+,,,,,Apple Valley,CA,92308,300,Active-adult community; ask about common-area service,"].join("\n") + "\n";
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="call-list-template.csv"' } });
}
