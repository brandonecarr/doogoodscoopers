import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import prisma from "@/lib/prisma";
import { geocodeAddress, resolveZips, normalizeZip } from "@/lib/geo/zipgeo";
import { CustomerMapClient } from "@/components/admin/CustomerMapClient";
import type { MapCustomer } from "@/components/admin/CustomerMapView";

export const dynamic = "force-dynamic";

export default async function CustomerMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await prisma.sweepandgoCustomer.findUnique({ where: { id } });
  if (!c) notFound();

  // Geocode the address once and cache lat/lng on the customer.
  let lat = c.lat, lng = c.lng;
  if (lat == null || lng == null) {
    const point = await geocodeAddress(c.address, c.zipCode);
    if (point) {
      lat = point.lat; lng = point.lng;
      await prisma.sweepandgoCustomer.update({ where: { id }, data: { lat, lng } }).catch(() => {});
    }
  }

  // City line from the zip centroid's place name, e.g. "Fontana, CA 92335".
  const zip5 = normalizeZip(c.zipCode);
  let cityLine = zip5 ? `CA ${zip5}` : "";
  if (zip5) {
    const place = (await resolveZips([zip5])).get(zip5)?.place || "";
    const city = place.split(",")[0]?.trim();
    if (city) cityLine = `${city}, CA ${zip5}`;
  }

  const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Customer";
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const header = (
    <div className="flex items-center gap-3 mb-4">
      <Link href={`/admin/customers/${id}`} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
        <ArrowLeft className="w-5 h-5 text-gray-600" />
      </Link>
      <h1 className="text-xl font-bold text-navy-900">{name} · Map</h1>
    </div>
  );

  if (lat == null || lng == null) {
    return (
      <div>
        {header}
        <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-500">
          Couldn&apos;t locate this customer&apos;s address on the map{token ? "." : " — set NEXT_PUBLIC_MAPBOX_TOKEN in Vercel first."}
        </div>
      </div>
    );
  }

  const customer: MapCustomer = {
    id: c.id,
    name,
    firstName: c.firstName || "",
    address: c.address || "",
    cityLine,
    zipCode: zip5 || "",
    lat, lng,
    phone: c.cellPhone || c.homePhone || "",
    email: c.email || "",
    numberOfDogs: c.numberOfDogs,
    cleanupFrequency: c.cleanupFrequency || "",
    serviceDays: c.serviceDays || "",
    subscriptionNames: c.subscriptionNames || "",
    assignedTo: c.assignedTo || "",
    startDate: (c.startDate ?? c.firstSeenAt)?.toISOString() ?? null,
    oneTimeClient: c.oneTimeClient,
  };

  return (
    <div>
      {header}
      <CustomerMapClient customer={customer} token={token} />
    </div>
  );
}
