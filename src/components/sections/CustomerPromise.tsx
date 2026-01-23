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
    glowColor: "rgba(20, 184, 166, 0.6)",
  },
  {
    icon: HeartHandshake,
    title: "Health and Safety Commitment",
    description:
      "DooGoodScoopers prioritizes health and safety by using sanitary practices and eco-friendly disposal methods, ensuring a clean, safe environment for Inland Empire pets and families.",
    color: "bg-navy-600",
    glowColor: "rgba(30, 64, 124, 0.6)",
  },
  {
    icon: ShieldCheck,
    title: "Satisfaction Guaranteed",
    description:
      "At DooGoodScoopers, we guarantee your satisfaction with our Inland Empire pooper scooper service. If you're not happy, we'll make it right—your satisfaction is our priority.",
    color: "bg-teal-600",
    glowColor: "rgba(13, 148, 136, 0.6)",
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
    <section ref={ref} className="py-24 bg-gradient-to-b from-white via-[#e2faf6] to-white overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
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
                className="promise-card rounded-2xl p-[1px] relative group hover:scale-105 transition-transform duration-300"
                style={{
                  background: "linear-gradient(135deg, rgba(20, 184, 166, 0.3) 0%, rgba(229, 231, 235, 0.5) 50%, rgba(30, 64, 124, 0.2) 100%)",
                }}
              >
                {/* Card Content */}
                <div className="promise-card-inner bg-white hover:bg-gradient-to-b hover:from-white hover:to-[rgba(156,213,207,0.5)] hover:shadow-lg transition-all duration-300 h-full rounded-2xl p-8 relative">
                  {/* Animated Dot - travels along the inner grid lines */}
                  <div
                    className="animated-dot w-[6px] h-[6px] z-[20] rounded-full absolute pointer-events-none"
                    style={{
                      background: "linear-gradient(135deg, #14b8a6, #0d9488)",
                      boxShadow: `${promise.glowColor} 0px 0px 12px`,
                      top: "12%",
                      right: "12%",
                      animation: "moveDot 4s linear infinite",
                      animationPlayState: "paused",
                    }}
                  />
                  {/* Subtle gradient glow in corner */}
                  <div
                    className="absolute -top-10 -left-10 w-40 h-40 rounded-full opacity-20 blur-3xl"
                    style={{
                      background: `radial-gradient(circle, ${promise.glowColor} 0%, transparent 70%)`,
                    }}
                  />

                  {/* Content */}
                  <div className="flex flex-col items-center text-center relative z-10">
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

                  {/* Decorative Grid Lines */}
                  <div
                    className="absolute h-[1px] left-0 right-0"
                    style={{
                      top: "12%",
                      background: "linear-gradient(90deg, transparent 0%, rgba(20, 184, 166, 0.15) 20%, rgba(20, 184, 166, 0.15) 80%, transparent 100%)",
                    }}
                  />
                  <div
                    className="absolute w-[1px] top-0 bottom-0"
                    style={{
                      left: "12%",
                      background: "linear-gradient(180deg, transparent 0%, rgba(20, 184, 166, 0.15) 20%, rgba(20, 184, 166, 0.15) 80%, transparent 100%)",
                    }}
                  />
                  <div
                    className="absolute h-[1px] left-0 right-0"
                    style={{
                      bottom: "12%",
                      background: "linear-gradient(90deg, transparent 0%, rgba(30, 64, 124, 0.1) 20%, rgba(30, 64, 124, 0.1) 80%, transparent 100%)",
                    }}
                  />
                  <div
                    className="absolute w-[1px] top-0 bottom-0"
                    style={{
                      right: "12%",
                      background: "linear-gradient(180deg, transparent 0%, rgba(30, 64, 124, 0.1) 20%, rgba(30, 64, 124, 0.1) 80%, transparent 100%)",
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Animated Dot Keyframes - travels along the inner grid lines at 12% */}
      <style jsx global>{`
        @keyframes moveDot {
          0%, 100% {
            top: 12%;
            right: 12%;
          }
          25% {
            top: 12%;
            right: calc(100% - 12%);
          }
          50% {
            top: calc(100% - 12%);
            right: calc(100% - 12%);
          }
          75% {
            top: calc(100% - 12%);
            right: 12%;
          }
        }

        .promise-card:hover .animated-dot {
          animation-play-state: running !important;
        }
      `}</style>
    </section>
  );
}
