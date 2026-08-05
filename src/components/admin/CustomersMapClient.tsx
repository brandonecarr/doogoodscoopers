"use client";

import dynamic from "next/dynamic";
import type { MapCustomer } from "./CustomerInfoPanels";

const CustomersMap = dynamic(() => import("./CustomersMap").then((m) => m.CustomersMap), {
  ssr: false,
  loading: () => <div className="w-full rounded-2xl bg-[#0b0f1a]" style={{ height: "calc(100vh - 210px)", minHeight: 560 }} />,
});

export function CustomersMapClient(props: { customers: MapCustomer[]; token: string | undefined; uncoded: number }) {
  return <CustomersMap {...props} />;
}
