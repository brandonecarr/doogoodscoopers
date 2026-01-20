"use client";

import { useState } from "react";
import { Preloader } from "@/components/animations/Preloader";
import { SmoothScrollProvider } from "@/components/providers/SmoothScrollProvider";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/sections/Hero";
import { StatsCounter } from "@/components/sections/StatsCounter";
import { ProcessSteps } from "@/components/sections/ProcessSteps";
import { WhatWeDo } from "@/components/sections/WhatWeDo";
import { CustomerPromise } from "@/components/sections/CustomerPromise";
import { ServiceAreas } from "@/components/sections/ServiceAreas";
import { Testimonials } from "@/components/sections/Testimonials";
import { CTASection } from "@/components/sections/CTASection";

export default function HomePage() {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <>
      <Preloader onComplete={() => setIsLoaded(true)} />

      {isLoaded && (
        <SmoothScrollProvider>
          <Header />
          <main>
            <Hero />
            <StatsCounter />
            <CustomerPromise />
            <ProcessSteps />
            <WhatWeDo />
            <Testimonials />
            <ServiceAreas />
            <CTASection />
          </main>
          <Footer />
        </SmoothScrollProvider>
      )}
    </>
  );
}
