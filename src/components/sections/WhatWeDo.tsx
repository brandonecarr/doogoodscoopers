"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { BeforeAfterSlider } from "@/components/ui/BeforeAfterSlider";

const beforeAfterPairs = [
  {
    before: "/images/before-after/before-1.webp",
    after: "/images/before-after/after-1.webp",
    beforeAlt: "Dirty yard with dog waste before cleanup",
    afterAlt: "Clean yard after professional cleanup",
  },
  {
    before: "/images/before-after/before-2.webp",
    after: "/images/before-after/after-2.webp",
    beforeAlt: "Backyard with dog waste on gravel",
    afterAlt: "Clean backyard after service",
  },
];

export function WhatWeDo() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <section ref={ref} className="py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-display-sm font-bold text-navy-900 mb-4">
            What Exactly Do We Do?
          </h2>
          <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
            We know how busy life can get. Sometimes, there are certain chores that just pile up on you—pun intended. This is why our pooper scoopers service is so valuable.
          </p>
        </motion.div>

        {/* Before/After Sliders */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12"
        >
          {beforeAfterPairs.map((pair, index) => (
            <motion.div key={index} variants={itemVariants}>
              <BeforeAfterSlider
                beforeImage={pair.before}
                afterImage={pair.after}
                beforeAlt={pair.beforeAlt}
                afterAlt={pair.afterAlt}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Drag hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 1, duration: 0.5 }}
          className="text-center text-sm text-navy-500/60 mt-8"
        >
          Drag the slider to see the transformation
        </motion.p>
      </div>
    </section>
  );
}
