"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { Star, Users, Dog, CheckCircle } from "lucide-react";
import { NumberCounter } from "@/components/animations/NumberCounter";
import { FloatingElementsLight } from "@/components/animations/FloatingElements";

const stats = [
  {
    icon: Star,
    value: 5.0,
    label: "Star Rating",
    suffix: "",
    decimals: 1,
    color: "text-yellow-400",
  },
  {
    icon: Users,
    value: 111,
    label: "Happy Families",
    suffix: "+",
    decimals: 0,
    color: "text-teal-500",
  },
  {
    icon: Dog,
    value: 240,
    label: "Happy Dogs",
    suffix: "+",
    decimals: 0,
    color: "text-navy-600",
  },
  {
    icon: CheckCircle,
    value: 2123,
    label: "Yards Completed",
    suffix: "",
    decimals: 0,
    color: "text-teal-600",
  },
];

export function StatsCounter() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
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
        ease: [0.16, 1, 0.3, 1] as const,
      },
    },
  };

  return (
    <section
      ref={ref}
      className="relative py-24 bg-gradient-to-b from-teal-50 to-white overflow-hidden"
    >
      <FloatingElementsLight variant="section" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-display-sm font-bold text-navy-900 mb-4">
            Trusted by Families Across the Inland Empire
          </h2>
          <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
            Join hundreds of satisfied customers who have taken back control of their yards
          </p>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-2 lg:grid-cols-4 gap-8"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className="relative group h-full"
              >
                <div className="bg-white rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-shadow duration-300 text-center h-full flex flex-col justify-center min-h-[240px]">
                  {/* Icon */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={isInView ? { scale: 1 } : {}}
                    transition={{
                      delay: 0.3 + index * 0.1,
                      type: "spring",
                      stiffness: 200,
                    }}
                    className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-50 mb-4 mx-auto ${stat.color}`}
                  >
                    <Icon className="w-8 h-8" />
                  </motion.div>

                  {/* Value */}
                  <div className="text-4xl md:text-5xl font-bold text-navy-900 mb-2">
                    <NumberCounter
                      value={stat.value}
                      suffix={stat.suffix}
                      decimals={stat.decimals}
                      duration={2}
                    />
                  </div>

                  {/* Label */}
                  <p className="text-navy-700/70 font-medium">{stat.label}</p>

                  {/* Star rating display - fixed height container */}
                  <div className="h-8 mt-3 flex items-center justify-center">
                    {stat.label === "Star Rating" && (
                      <div className="flex justify-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={isInView ? { opacity: 1, scale: 1 } : {}}
                            transition={{ delay: 0.5 + i * 0.1 }}
                          >
                            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
