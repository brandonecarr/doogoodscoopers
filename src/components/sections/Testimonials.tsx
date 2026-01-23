"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { PawPrint } from "lucide-react";

export function Testimonials() {
  const ref = useRef<HTMLElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  useEffect(() => {
    // Only load widget once and only when in view
    if (widgetLoaded || !isInView) return;

    // Clean up any existing TrustIndex elements first
    const cleanup = () => {
      // Remove any existing scripts
      document.querySelectorAll('script[src*="trustindex.io"]').forEach(el => el.remove());
      // Remove any existing widget elements from body (but not our container)
      document.querySelectorAll('body > .ti-widget, body > [class*="ti-"]').forEach(el => {
        if (!widgetContainerRef.current?.contains(el)) {
          el.remove();
        }
      });
    };

    cleanup();

    // Create and load the TrustIndex script
    const script = document.createElement("script");
    script.src = "https://cdn.trustindex.io/loader.js?66c43da43da848017c26e042639";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setWidgetLoaded(true);

      // Watch for the widget to be created and move it to our container
      const moveWidget = () => {
        const widget = document.querySelector('body > .ti-widget, body > [data-trustindex-widget]');
        if (widget && widgetContainerRef.current && !widgetContainerRef.current.contains(widget)) {
          widgetContainerRef.current.appendChild(widget);
        }
      };

      // Try immediately
      moveWidget();

      // Also observe for delayed creation
      const observer = new MutationObserver(() => {
        moveWidget();
      });

      observer.observe(document.body, { childList: true, subtree: false });

      // Stop observing after 5 seconds
      setTimeout(() => observer.disconnect(), 5000);
    };

    document.body.appendChild(script);

    return () => {
      cleanup();
    };
  }, [isInView, widgetLoaded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Remove script
      document.querySelectorAll('script[src*="trustindex.io"]').forEach(el => el.remove());
      // Remove all TrustIndex elements from body
      document.querySelectorAll('body > .ti-widget, body > [class*="ti-"], body > [data-trustindex-widget]').forEach(el => {
        el.remove();
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
          <div
            ref={widgetContainerRef}
            className="trustindex-widget-container"
          />
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
