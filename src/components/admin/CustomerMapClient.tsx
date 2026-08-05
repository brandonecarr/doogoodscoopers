"use client";

import dynamic from "next/dynamic";
import type { MapCustomer } from "./CustomerMapView";

// mapbox-gl touches window + we do live date math, so render client-only.
const CustomerMapView = dynamic(() => import("./CustomerMapView").then((m) => m.CustomerMapView), {
  ssr: false,
  loading: () => <div className="w-full rounded-2xl bg-[#0b0f1a]" style={{ height: "calc(100vh - 130px)", minHeight: 560 }} />,
});

export function CustomerMapClient(props: { customer: MapCustomer; token: string | undefined }) {
  return <CustomerMapView {...props} />;
}
