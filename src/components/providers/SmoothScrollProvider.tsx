"use client";

import { useEffect, useRef, ReactNode, createContext, useContext, useCallback, useState } from "react";
import Lenis from "@studio-freight/lenis";
import { gsap, ScrollTrigger } from "@/lib/gsap";

interface SmoothScrollContextType {
  stopScroll: () => void;
  startScroll: () => void;
}

const SmoothScrollContext = createContext<SmoothScrollContextType | null>(null);

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}

interface SmoothScrollProviderProps {
  children: ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const lenisRef = useRef<Lenis | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      smoothWheel: true,
    });

    lenisRef.current = lenis;
    setIsReady(true);

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });

    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove((time) => {
        lenis.raf(time * 1000);
      });
    };
  }, []);

  const stopScroll = useCallback(() => {
    lenisRef.current?.stop();
  }, []);

  const startScroll = useCallback(() => {
    lenisRef.current?.start();
  }, []);

  return (
    <SmoothScrollContext.Provider value={{ stopScroll, startScroll }}>
      {children}
    </SmoothScrollContext.Provider>
  );
}
