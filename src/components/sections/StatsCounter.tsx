"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { PawPrint, Users, Dog, CheckCircle } from "lucide-react";
import { NumberCounter } from "@/components/animations/NumberCounter";
import { FloatingElementsLight } from "@/components/animations/FloatingElements";

const stats = [
  {
    icon: PawPrint,
    value: 5.0,
    label: "Paw Rating",
    suffix: "",
    decimals: 1,
    color: "text-yellow-400",
    tagline: "Perfect 5-paw rating on Google",
    accent: "from-yellow-500 to-amber-500",
    bgColor: "#008EFF",
    bgImage: "/images/stats/star-rating-bg.png",
  },
  {
    icon: Users,
    value: 111,
    label: "Happy Families",
    suffix: "+",
    decimals: 0,
    color: "text-teal-500",
    image: "/images/stats/happy-families.jpg",
    tagline: "Highly trusted staff",
    accent: "from-teal-500 to-cyan-500",
    imageStyle: "object-[30%_40%] scale-125",
  },
  {
    icon: Dog,
    value: 240,
    label: "Happy Dogs",
    suffix: "+",
    decimals: 0,
    color: "text-navy-600",
    image: "/images/stats/happy-dogs.jpg",
    tagline: "Pups enjoying cleaner yards",
    accent: "from-blue-500 to-indigo-500",
    imageStyle: "object-[50%_35%]",
  },
  {
    icon: CheckCircle,
    value: 2123,
    label: "Yards Completed",
    suffix: "",
    decimals: 0,
    color: "text-teal-600",
    image: "/images/stats/yards-completed.jpg",
    tagline: "We specialize in beautiful yards",
    accent: "from-emerald-500 to-teal-500",
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
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                variants={itemVariants}
                className="relative group"
              >
                <div
                  className="relative overflow-hidden h-80 sm:h-96 rounded-3xl"
                  style={{
                    boxShadow: '0 2.8px 2.2px rgba(0, 0, 0, 0.034), 0 6.7px 5.3px rgba(0, 0, 0, 0.048), 0 12.5px 10px rgba(0, 0, 0, 0.06), 0 22.3px 17.9px rgba(0, 0, 0, 0.072), 0 41.8px 33.4px rgba(0, 0, 0, 0.086), 0 100px 80px rgba(0, 0, 0, 0.12)',
                  }}
                >
                  {/* Background */}
                  {stat.image ? (
                    <img
                      src={stat.image}
                      alt={stat.label}
                      className={`absolute inset-0 w-full h-full object-cover ${stat.imageStyle || ''}`}
                    />
                  ) : stat.bgImage ? (
                    <>
                      <img
                        src={stat.bgImage}
                        alt={stat.label}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div
                        className="absolute inset-0"
                        style={{ backgroundColor: stat.bgColor, opacity: 0.85 }}
                      />
                    </>
                  ) : stat.bgColor ? (
                    <div
                      className="absolute inset-0"
                      style={{ backgroundColor: stat.bgColor }}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-navy-800 to-navy-900" />
                  )}
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Top Badge */}
                  <div className="absolute top-4 left-4 right-4">
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={isInView ? { scale: 1, opacity: 1 } : {}}
                      transition={{
                        delay: 0.3 + index * 0.1,
                        type: "spring",
                        stiffness: 200,
                      }}
                      className="flex items-center gap-2 backdrop-blur-md rounded-full pl-2 pr-4 py-1.5 bg-black/40"
                    >
                      <div className="rounded-full p-1.5 bg-white/25">
                        <Icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-xs font-medium text-white/90">{stat.tagline}</span>
                    </motion.div>
                  </div>

                  {/* Bottom Stats Display */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="backdrop-blur-sm rounded-2xl p-4 bg-white/10">
                      {/* Value */}
                      <div className="text-4xl md:text-5xl font-bold text-white mb-1">
                        <NumberCounter
                          value={stat.value}
                          suffix={stat.suffix}
                          decimals={stat.decimals}
                          duration={2}
                        />
                      </div>

                      {/* Label */}
                      <p className="text-white/80 font-medium text-sm">{stat.label}</p>

                      {/* Star rating display */}
                      {stat.label === "Star Rating" && (
                        <div className="flex gap-1 mt-2">
                          {[...Array(5)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, scale: 0 }}
                              animate={isInView ? { opacity: 1, scale: 1 } : {}}
                              transition={{ delay: 0.5 + i * 0.1 }}
                            >
                              <PawPrint className="w-4 h-4 text-[#008EFF] fill-[#008EFF]" />
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Animated paw prints */}
                      <div className="flex gap-1.5 mt-3">
                        {[...Array(5)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0, y: 5 }}
                            animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
                            transition={{
                              delay: 0.6 + index * 0.1 + i * 0.08,
                              type: "spring",
                              stiffness: 300,
                              damping: 15,
                            }}
                          >
                            <PawPrint className="w-3.5 h-3.5 text-white/70 fill-white/70" />
                          </motion.div>
                        ))}
                      </div>
                    </div>
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
