"use client";

import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { PawPrint } from "lucide-react";

export function Testimonials() {
  const ref = useRef<HTMLElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    // Check if script already exists to prevent duplicates
    const existingScript = document.querySelector('script[src*="trustindex.io/loader.js"]');
    if (!existingScript) {
      // Load TrustIndex script
      const script = document.createElement("script");
      script.src = "https://cdn.trustindex.io/loader.js?66c43da43da848017c26e042639";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }

    // Move existing widget if it exists (from previous render or HMR)
    const existingWidget = document.querySelector('.ti-widget, [data-trustindex-widget]');
    if (existingWidget && widgetContainerRef.current && !widgetContainerRef.current.contains(existingWidget)) {
      widgetContainerRef.current.appendChild(existingWidget);
    }

    // Watch for the TrustIndex widget to be added to the DOM and move it to our container
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node instanceof HTMLElement &&
              (node.classList.contains('ti-widget') || node.getAttribute('data-trustindex-widget'))) {
            if (widgetContainerRef.current && !widgetContainerRef.current.contains(node)) {
              widgetContainerRef.current.appendChild(node);
              observer.disconnect();
            }
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Helper to check if an element is inside a fixed overlay (modal)
    const isInsideFixedOverlay = (element: HTMLElement | null): HTMLElement | null => {
      while (element && element !== document.body) {
        const style = window.getComputedStyle(element);
        if (style.position === 'fixed' && parseInt(style.zIndex) > 100) {
          return element;
        }
        element = element.parentElement;
      }
      return null;
    };

    // Global wheel handler - intercept wheel events on fixed overlays
    // This runs in capture phase to stop events before Lenis sees them
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement;
      const fixedOverlay = isInsideFixedOverlay(target);

      if (fixedOverlay) {
        // Stop propagation so Lenis doesn't intercept this scroll
        e.stopPropagation();
      }
    };

    // Add in capture phase, must not be passive to allow stopPropagation
    document.addEventListener('wheel', handleWheel, { capture: true });

    return () => {
      observer.disconnect();
      document.removeEventListener('wheel', handleWheel, { capture: true });
      // Cleanup on unmount - remove script and any widget elements
      const existingScript = document.querySelector(
        'script[src*="trustindex.io/loader.js"]'
      );
      if (existingScript) {
        existingScript.remove();
      }
      // Remove any TrustIndex widget elements that may have been added to body
      document.querySelectorAll('.ti-widget, [data-trustindex-widget]').forEach(el => {
        if (!widgetContainerRef.current?.contains(el)) {
          el.remove();
        }
      });
    };
  }, []);

  return (
    <section
      ref={ref}
      className="py-24 bg-gradient-to-b from-white to-teal-50 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-display-sm font-bold text-navy-900 mb-4">
            What Our Customers Say
          </h2>
          <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
            Don&apos;t just take our word for it. Here&apos;s what families across the Inland Empire have to say.
          </p>
        </motion.div>

        {/* TrustIndex Google Reviews Widget */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="w-full"
        >
          <div ref={widgetContainerRef} className="trustindex-widget-container" />
        </motion.div>

        {/* Additional Trust Elements */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-8 text-navy-700/60 mt-12"
        >
          <div className="flex items-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <PawPrint key={i} className="w-5 h-5 text-[#008EFF] fill-[#008EFF]" />
              ))}
            </div>
            <span className="font-medium">5.0 on Google</span>
          </div>
          <div className="h-4 w-px bg-navy-200" />
          <span className="font-medium">100% Satisfaction Guaranteed</span>
        </motion.div>
      </div>
    </section>
  );
}
