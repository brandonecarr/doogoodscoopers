"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { ClipboardList, Calendar, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

const steps = [
  {
    number: 1,
    title: "Get Your Quote",
    description:
      "Tell us about your yard and furry friends. We'll provide a free, no-obligation quote tailored to your needs.",
    icon: ClipboardList,
    color: "bg-teal-500",
  },
  {
    number: 2,
    title: "Schedule Service",
    description:
      "Choose a day that works for you. We offer flexible weekly, bi-weekly, or one-time cleanings.",
    icon: Calendar,
    color: "bg-navy-600",
  },
  {
    number: 3,
    title: "Enjoy Your Yard",
    description:
      "Relax while we do the dirty work. Come home to a fresh, clean yard every time.",
    icon: Sparkles,
    color: "bg-teal-600",
  },
];

export function ProcessSteps() {
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
    hidden: { opacity: 0, y: 50 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.7,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  const lineVariants: Variants = {
    hidden: { scaleX: 0 },
    visible: {
      scaleX: 1,
      transition: {
        duration: 0.8,
        delay: 0.5,
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  return (
    <section ref={ref} className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <h2 className="text-display-sm font-bold text-navy-900 mb-4">
            How It Works
          </h2>
          <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
            Getting started is easy. Three simple steps to a cleaner, healthier yard.
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="relative"
        >
          {/* Steps Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8 relative">
            {/* Connection Line (Desktop) - positioned to connect circle centers */}
            <motion.div
              variants={lineVariants}
              className="hidden lg:block absolute top-10 left-[16.67%] right-[16.67%] h-0.5 bg-gradient-to-r from-teal-500 via-navy-600 to-teal-600 origin-left -z-10"
            />
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.number}
                  variants={itemVariants}
                  className="relative"
                >
                  <div className="flex flex-col items-center text-center">
                    {/* Step Number & Icon */}
                    <motion.div
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className="relative mb-8"
                    >
                      {/* Background Circle */}
                      <div className={`w-20 h-20 rounded-full ${step.color} flex items-center justify-center shadow-lg`}>
                        <Icon className="w-10 h-10 text-white" />
                      </div>

                      {/* Step Number Badge */}
                      <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
                        <span className="text-sm font-bold text-navy-900">
                          {step.number}
                        </span>
                      </div>
                    </motion.div>

                    {/* Content */}
                    <h3 className="text-2xl font-bold text-navy-900 mb-4">
                      {step.title}
                    </h3>
                    <p className="text-navy-700/70 leading-relaxed max-w-sm">
                      {step.description}
                    </p>

                    {/* Arrow (Mobile) */}
                    {index < steps.length - 1 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={isInView ? { opacity: 1 } : {}}
                        transition={{ delay: 0.5 + index * 0.2 }}
                        className="lg:hidden mt-8"
                      >
                        <ArrowRight className="w-6 h-6 text-teal-500 rotate-90" />
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 1, duration: 0.6 }}
          className="text-center mt-16"
        >
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
          >
            <Link href="/quote" className="btn-primary text-lg inline-flex items-center gap-2">
              Start With Step 1
              <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
