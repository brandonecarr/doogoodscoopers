"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { CheckCircle, HeartHandshake, ShieldCheck } from "lucide-react";

const promises = [
  {
    icon: CheckCircle,
    title: "Reliable, Hassle-Free Service",
    description:
      "Our reliable, hassle-free pooper scooper service ensures timely, efficient visits, leaving your yard pristine. Enjoy more time with your dog—let us handle the mess!",
    color: "bg-teal-500",
  },
  {
    icon: HeartHandshake,
    title: "Health and Safety Commitment",
    description:
      "DooGoodScoopers prioritizes health and safety by using sanitary practices and eco-friendly disposal methods, ensuring a clean, safe environment for Inland Empire pets and families.",
    color: "bg-navy-600",
  },
  {
    icon: ShieldCheck,
    title: "Satisfaction Guaranteed",
    description:
      "At DooGoodScoopers, we guarantee your satisfaction with our Inland Empire pooper scooper service. If you're not happy, we'll make it right—your satisfaction is our priority.",
    color: "bg-teal-600",
  },
];

export function CustomerPromise() {
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
            Our Customer Promise
          </h2>
          <p className="text-lg text-navy-700/70 max-w-2xl mx-auto">
            We are customer driven through and through. Our customers' satisfaction is our top priority, and we make every effort to ensure it.
          </p>
        </motion.div>

        {/* Promise Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {promises.map((promise, index) => {
            const Icon = promise.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="bg-white rounded-2xl p-8 shadow-card hover:shadow-xl transition-shadow"
              >
                <div className="flex flex-col items-center text-center">
                  {/* Icon */}
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                    className="mb-6"
                  >
                    <div className={`w-16 h-16 rounded-full ${promise.color} flex items-center justify-center shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                  </motion.div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-navy-900 mb-4">
                    {promise.title}
                  </h3>

                  {/* Description */}
                  <p className="text-navy-700/70 leading-relaxed">
                    {promise.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
