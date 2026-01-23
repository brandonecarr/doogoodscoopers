"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "@/lib/gsap";

interface PreloaderProps {
  onComplete?: () => void;
}

export function Preloader({ onComplete }: PreloaderProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [percentage, setPercentage] = useState(0);

  useEffect(() => {
    // Animate percentage counter
    const counter = { value: 0 };

    gsap.to(counter, {
      value: 100,
      duration: 1.8,
      ease: "power2.out",
      onUpdate: () => {
        setPercentage(Math.round(counter.value));
      },
      onComplete: () => {
        setTimeout(() => {
          setIsLoading(false);
          onComplete?.();
        }, 200);
      },
    });
  }, [onComplete]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="preloader"
          initial={{ opacity: 1 }}
          exit={{
            y: "-100%",
            transition: {
              duration: 0.8,
              ease: [0.16, 1, 0.3, 1]
            }
          }}
        >
          {/* Background dog icons */}
          <div className="absolute inset-0 overflow-hidden">
            {/* Top left - large, 40% opacity */}
            <motion.div
              className="absolute top-[8%] left-[8%] w-36 h-36"
              animate={{
                y: [0, -20, 0],
                rotate: [0, 5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={144}
                height={144}
                className="w-full h-full opacity-40"
                priority
              />
            </motion.div>

            {/* Top right - medium, 20% opacity */}
            <motion.div
              className="absolute top-[12%] right-[12%] w-28 h-28"
              animate={{
                y: [0, 15, 0],
                rotate: [0, -8, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={112}
                height={112}
                className="w-full h-full opacity-20"
              />
            </motion.div>

            {/* Middle left - small, 60% opacity */}
            <motion.div
              className="absolute top-[35%] left-[5%] w-20 h-20"
              animate={{
                scale: [1, 1.15, 1],
                rotate: [0, 10, 0],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={80}
                height={80}
                className="w-full h-full opacity-60"
              />
            </motion.div>

            {/* Middle right - extra large, 20% opacity */}
            <motion.div
              className="absolute top-[30%] right-[8%] w-44 h-44"
              animate={{
                y: [0, -15, 0],
              }}
              transition={{
                duration: 6,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={176}
                height={176}
                className="w-full h-full opacity-20"
              />
            </motion.div>

            {/* Center area - tiny, 60% opacity */}
            <motion.div
              className="absolute top-[55%] left-[25%] w-16 h-16"
              animate={{
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={64}
                height={64}
                className="w-full h-full opacity-60"
              />
            </motion.div>

            {/* Bottom left - large, 40% opacity */}
            <motion.div
              className="absolute bottom-[15%] left-[12%] w-40 h-40"
              animate={{
                y: [0, 20, 0],
                rotate: [0, -5, 0],
              }}
              transition={{
                duration: 5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={160}
                height={160}
                className="w-full h-full opacity-40"
              />
            </motion.div>

            {/* Bottom right - extra large, 40% opacity */}
            <motion.div
              className="absolute bottom-[18%] right-[10%] w-48 h-48"
              animate={{
                y: [0, 25, 0],
                rotate: [0, -6, 0],
              }}
              transition={{
                duration: 5.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={192}
                height={192}
                className="w-full h-full opacity-40"
              />
            </motion.div>

            {/* Bottom center - small, 20% opacity */}
            <motion.div
              className="absolute bottom-[25%] left-[45%] w-24 h-24"
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, 0],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={96}
                height={96}
                className="w-full h-full opacity-20"
              />
            </motion.div>

            {/* Top center - medium, 60% opacity */}
            <motion.div
              className="absolute top-[5%] left-[40%] w-20 h-20"
              animate={{
                y: [0, 12, 0],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Image
                src="/dog-icon.svg"
                alt=""
                width={80}
                height={80}
                className="w-full h-full opacity-60"
              />
            </motion.div>
          </div>

          {/* Logo with opacity reveal effect - 200% larger */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="relative z-10"
          >
            <div className="relative">
              {/* Low opacity logo (background) */}
              <Image
                src="/logo.webp"
                alt="DooGoodScoopers"
                width={600}
                height={200}
                className="h-32 md:h-40 w-auto opacity-10"
                priority
              />

              {/* Full opacity logo with clip mask that reveals from bottom */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{
                  clipPath: `inset(${100 - percentage}% 0 0 0)`,
                  transition: 'clip-path 0.1s ease-out'
                }}
              >
                <Image
                  src="/logo.webp"
                  alt="DooGoodScoopers"
                  width={600}
                  height={200}
                  className="h-32 md:h-40 w-auto"
                  priority
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
