"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { MapCustomer } from "./CustomerInfoPanels";

// mapbox-gl is heavy and touches window — load the planner only on the client.
const RoutePlanner = dynamic(() => import("./RoutePlanner").then((m) => m.RoutePlanner), {
  ssr: false,
  loading: () => (
    <div className="dgs-card flex items-center justify-center" style={{ height: "60vh" }}>
      <Loader2 className="w-8 h-8 animate-spin text-iris" />
    </div>
  ),
});

export function RoutePlannerClient(props: {
  customers: MapCustomer[];
  token: string | undefined;
  initialAssignments: Record<string, number>;
}) {
  return <RoutePlanner {...props} />;
}
