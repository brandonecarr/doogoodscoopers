"use client";

import { useRef } from "react";
import { motion, useInView, type Variants } from "framer-motion";
import { CheckCircle, HeartHandshake, ShieldCheck, Heart } from "lucide-react";

const promises = [
  {
    icon: CheckCircle,
    title: "Reliable, Hassle-Free Service",
    description:
      "Our reliable, hassle-free pooper scooper service ensures timely, efficient visits, leaving your yard pristine. Enjoy more time with your dog—let us handle the mess!",
    glowColor: "rgba(20, 184, 166, 0.8)", // teal
  },
  {
    icon: HeartHandshake,
    title: "Health and Safety Commitment",
    description:
      "DooGoodScoopers prioritizes health and safety by using sanitary practices and eco-friendly disposal methods, ensuring a clean, safe environment for Inland Empire pets and families.",
    glowColor: "rgba(6, 182, 212, 0.8)", // cyan
  },
  {
    icon: ShieldCheck,
    title: "Satisfaction Guaranteed",
    description:
      "At DooGoodScoopers, we guarantee your satisfaction with our Inland Empire pooper scooper service. If you're not happy, we'll make it right—your satisfaction is our priority.",
    glowColor: "rgba(34, 197, 94, 0.8)", // green
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
        ease: [0.16, 1, 0.3, 1],
      },
    },
  };

  return (
    <section ref={ref} className="relative z-10 bg-[#0a0a0a] overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-200 backdrop-blur mb-6"
          >
            <Heart className="h-3.5 w-3.5 text-teal-400" />
            Our Promise
          </motion.div>

          <h2 className="text-3xl sm:text-4xl font-semibold text-white tracking-tight">
            Our Customer Promise
          </h2>
          <p className="mt-3 text-base text-zinc-400 max-w-2xl mx-auto">
            We are customer driven through and through. Your satisfaction is our top priority.
          </p>
        </motion.div>

        {/* Promise Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {promises.map((promise, index) => {
            const Icon = promise.icon;
            return (
              <motion.div
                key={index}
                variants={itemVariants}
                className="promise-card rounded-2xl p-[1px] relative group"
                style={{
                  background: "radial-gradient(circle 230px at 0% 0%, rgba(113, 113, 122, 0.4), #0c0d0d)",
                }}
              >
                {/* Animated Dot */}
                <div
                  className="animated-dot bg-teal-400 w-[5px] h-[5px] z-[2] rounded-full absolute"
                  style={{
                    boxShadow: `${promise.glowColor} 0px 0px 10px`,
                    right: "10%",
                    top: "10%",
                  }}
                />

                {/* Card Content */}
                <div
                  className="hover:bg-white/10 transition-all duration-300 z-[1] bg-white/5 h-full rounded-2xl p-7 sm:p-9 relative backdrop-blur"
                  style={{
                    background: "radial-gradient(circle 280px at 0% 0%, rgba(68, 68, 68, 0.3), #0c0d0d)",
                    border: "1px solid #202222",
                  }}
                >
                  {/* Blur Glow Effect */}
                  <div
                    className="blur-[10px] z-10 opacity-40 w-[220px] h-[45px] rounded-full absolute top-0 left-0"
                    style={{
                      backgroundColor: "rgba(113, 113, 122, 0.3)",
                      boxShadow: "0 0 50px rgba(113, 113, 122, 0.5)",
                      transform: "rotate(40deg)",
                      transformOrigin: "10%",
                    }}
                  />

                  {/* Icon */}
                  <div className="flex z-10 relative items-start justify-between">
                    <div className="flex w-12 h-12 rounded-xl items-center justify-center bg-white/5">
                      <Icon className="w-6 h-6 text-teal-400" />
                    </div>
                  </div>

                  {/* Title */}
                  <h3 className="mt-4 text-lg font-semibold tracking-tight text-white relative z-10">
                    {promise.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 text-sm text-zinc-400 relative z-10 leading-relaxed">
                    {promise.description}
                  </p>

                  {/* Decorative Grid Lines */}
                  <div
                    className="w-full h-[1px] absolute"
                    style={{
                      top: "10%",
                      left: "0%",
                      background: "linear-gradient(90deg, rgba(136, 136, 136, 0.3) 30%, #1d1f1f 70%)",
                      maskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
                      WebkitMaskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
                    }}
                  />
                  <div
                    className="w-[1px] h-full absolute"
                    style={{
                      left: "10%",
                      top: "0%",
                      background: "linear-gradient(180deg, rgba(116, 116, 116, 0.3) 30%, #222424 70%)",
                      maskImage: "linear-gradient(0deg, transparent, black 15%, black 85%, transparent)",
                      WebkitMaskImage: "linear-gradient(0deg, transparent, black 15%, black 85%, transparent)",
                    }}
                  />
                  <div
                    className="bg-slate-50/5 w-full h-[1px] absolute"
                    style={{
                      bottom: "10%",
                      left: "0%",
                      maskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
                      WebkitMaskImage: "linear-gradient(90deg, transparent, black 15%, black 85%, transparent)",
                    }}
                  />
                  <div
                    className="bg-slate-50/5 w-[1px] h-full absolute"
                    style={{
                      right: "10%",
                      top: "0%",
                      maskImage: "linear-gradient(0deg, transparent, black 15%, black 85%, transparent)",
                      WebkitMaskImage: "linear-gradient(0deg, transparent, black 15%, black 85%, transparent)",
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Animated Dot Keyframes */}
      <style jsx>{`
        @keyframes moveDot {
          0%, 100% {
            top: 10%;
            right: 10%;
          }
          25% {
            top: 10%;
            right: calc(100% - 35px);
          }
          50% {
            top: calc(100% - 30px);
            right: calc(100% - 35px);
          }
          75% {
            top: calc(100% - 30px);
            right: 10%;
          }
        }

        .promise-card:hover .animated-dot {
          animation: moveDot 6s linear infinite;
        }
      `}</style>
    </section>
  );
}
