"use client";

import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { PawPrint } from "lucide-react";

export function Testimonials() {
  const ref = useRef<HTMLElement>(null);
  const widgetContainerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    // Load TrustIndex script
    const script = document.createElement("script");
    script.src = "https://cdn.trustindex.io/loader.js?66c43da43da848017c26e042639";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

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

    // Watch for TrustIndex modal opens to lock body scroll
    const lockScroll = () => {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      // Stop Lenis if it exists
      const lenis = (window as unknown as { lenis?: { stop: () => void } }).lenis;
      if (lenis) lenis.stop();
    };

    const unlockScroll = () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      // Resume Lenis if it exists
      const lenis = (window as unknown as { lenis?: { start: () => void } }).lenis;
      if (lenis) lenis.start();
    };

    // Track if modal is open (based on user clicks, not DOM observation)
    let modalOpen = false;

    const openModal = () => {
      modalOpen = true;
      lockScroll();
    };

    const closeModal = () => {
      if (modalOpen) {
        modalOpen = false;
        unlockScroll();
      }
    };

    // Use click event delegation to detect when "Read more" is clicked
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      // Check if clicked element is a "Read more" link
      if (target.closest('.ti-read-more') ||
          target.closest('[class*="read-more"]') ||
          (target.textContent?.toLowerCase().includes('read more') && target.tagName !== 'DIV')) {
        setTimeout(openModal, 100);
        return;
      }

      // Check for close button clicks or clicking on overlay background
      if (modalOpen && (
          target.closest('.ti-close') ||
          target.closest('[class*="close"]') ||
          target.closest('.ti-modal-close') ||
          target.classList.contains('ti-modal') ||
          target.classList.contains('ti-overlay') ||
          (target.style.position === 'fixed' && target.style.background?.includes('rgba')))) {
        setTimeout(closeModal, 100);
      }
    };

    document.addEventListener('click', handleClick);

    // Listen for Escape key to close modal
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        closeModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      observer.disconnect();
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
      // Cleanup on unmount
      const existingScript = document.querySelector(
        'script[src*="trustindex.io/loader.js"]'
      );
      if (existingScript) {
        existingScript.remove();
      }
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
