"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useState, useRef } from "react";

interface FloatingItem {
  emoji: string;
  position: { top?: string; bottom?: string; left?: string; right?: string };
  size: string;
  rotation: number;
  delay: number;
  duration: number;
  reverse?: boolean;
  yDistance: number;
  xDistance: number;
  opacity: number;
}

// Generate lots of floating items
const generateFloatingItems = (): FloatingItem[] => {
  const emojis = ["🐾", "🦴", "🐕", "🐶", "🐾", "🦴", "🐾", "🦴"];
  const items: FloatingItem[] = [];

  // MASSIVE elements (6)
  const massiveSizes = ["text-[220px]", "text-[200px]", "text-[180px]", "text-[160px]", "text-[150px]", "text-[140px]"];
  const massivePositions = [
    { top: "-15%", right: "-8%" },
    { bottom: "-18%", left: "-12%" },
    { top: "35%", left: "-10%" },
    { bottom: "-10%", right: "-5%" },
    { top: "-8%", left: "20%" },
    { top: "60%", right: "-8%" },
  ];
  massiveSizes.forEach((size, i) => {
    items.push({
      emoji: emojis[i % emojis.length],
      position: massivePositions[i],
      size,
      rotation: Math.random() * 60 - 30,
      delay: Math.random() * 4,
      duration: 12 + Math.random() * 8,
      reverse: Math.random() > 0.5,
      yDistance: 50 + Math.random() * 30,
      xDistance: 20 + Math.random() * 15,
      opacity: 0.18 + Math.random() * 0.1,
    });
  });

  // Extra large elements (8)
  for (let i = 0; i < 8; i++) {
    items.push({
      emoji: emojis[i % emojis.length],
      position: {
        top: `${Math.random() * 80}%`,
        left: `${Math.random() * 80}%`,
      },
      size: `text-[${100 + Math.floor(Math.random() * 30)}px]`,
      rotation: Math.random() * 80 - 40,
      delay: Math.random() * 5,
      duration: 10 + Math.random() * 6,
      reverse: Math.random() > 0.5,
      yDistance: 40 + Math.random() * 25,
      xDistance: 15 + Math.random() * 15,
      opacity: 0.22 + Math.random() * 0.12,
    });
  }

  // Large elements (10)
  for (let i = 0; i < 10; i++) {
    items.push({
      emoji: emojis[i % emojis.length],
      position: {
        top: `${Math.random() * 90}%`,
        left: `${Math.random() * 90}%`,
      },
      size: ["text-8xl", "text-7xl"][Math.floor(Math.random() * 2)],
      rotation: Math.random() * 100 - 50,
      delay: Math.random() * 5,
      duration: 8 + Math.random() * 5,
      reverse: Math.random() > 0.5,
      yDistance: 30 + Math.random() * 20,
      xDistance: 12 + Math.random() * 12,
      opacity: 0.28 + Math.random() * 0.12,
    });
  }

  // Medium elements (12)
  for (let i = 0; i < 12; i++) {
    items.push({
      emoji: emojis[i % emojis.length],
      position: {
        top: `${Math.random() * 95}%`,
        left: `${Math.random() * 95}%`,
      },
      size: ["text-6xl", "text-5xl"][Math.floor(Math.random() * 2)],
      rotation: Math.random() * 90 - 45,
      delay: Math.random() * 5,
      duration: 6 + Math.random() * 4,
      reverse: Math.random() > 0.5,
      yDistance: 20 + Math.random() * 15,
      xDistance: 8 + Math.random() * 10,
      opacity: 0.32 + Math.random() * 0.12,
    });
  }

  // Small elements (10)
  for (let i = 0; i < 10; i++) {
    items.push({
      emoji: emojis[i % emojis.length],
      position: {
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
      },
      size: ["text-4xl", "text-3xl", "text-2xl"][Math.floor(Math.random() * 3)],
      rotation: Math.random() * 70 - 35,
      delay: Math.random() * 4,
      duration: 5 + Math.random() * 3,
      reverse: Math.random() > 0.5,
      yDistance: 15 + Math.random() * 10,
      xDistance: 5 + Math.random() * 8,
      opacity: 0.35 + Math.random() * 0.15,
    });
  }

  return items;
};

interface FloatingEmojiProps {
  item: FloatingItem;
  mouseX: ReturnType<typeof useMotionValue<number>>;
  mouseY: ReturnType<typeof useMotionValue<number>>;
  isMouseOnScreen: boolean;
}

function FloatingEmoji({ item, mouseX, mouseY, isMouseOnScreen }: FloatingEmojiProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Calculate repulsion from mouse
  const repelX = useTransform([mouseX, mouseY], ([latestX, latestY]) => {
    if (!ref.current || !isMouseOnScreen) return 0;
    const rect = ref.current.getBoundingClientRect();
    const elemX = rect.left + rect.width / 2;
    const elemY = rect.top + rect.height / 2;

    const dx = elemX - (latestX as number);
    const dy = elemY - (latestY as number);
    const distance = Math.sqrt(dx * dx + dy * dy);

    const repelRadius = 200;
    if (distance < repelRadius && distance > 0) {
      const force = (repelRadius - distance) / repelRadius;
      return (dx / distance) * force * 120;
    }
    return 0;
  });

  const repelY = useTransform([mouseX, mouseY], ([latestX, latestY]) => {
    if (!ref.current || !isMouseOnScreen) return 0;
    const rect = ref.current.getBoundingClientRect();
    const elemX = rect.left + rect.width / 2;
    const elemY = rect.top + rect.height / 2;

    const dx = elemX - (latestX as number);
    const dy = elemY - (latestY as number);
    const distance = Math.sqrt(dx * dx + dy * dy);

    const repelRadius = 200;
    if (distance < repelRadius && distance > 0) {
      const force = (repelRadius - distance) / repelRadius;
      return (dy / distance) * force * 120;
    }
    return 0;
  });

  const springX = useSpring(repelX, { stiffness: 150, damping: 15 });
  const springY = useSpring(repelY, { stiffness: 150, damping: 15 });

  return (
    <motion.div
      ref={ref}
      className={`absolute ${item.size} select-none`}
      style={{
        ...item.position,
        opacity: item.opacity,
        x: springX,
        y: springY,
      }}
      initial={{ rotate: item.rotation }}
      animate={{
        y: item.reverse ? [0, item.yDistance, 0] : [0, -item.yDistance, 0],
        x: item.reverse ? [0, -item.xDistance, 0] : [0, item.xDistance, 0],
        rotate: [item.rotation, item.rotation + (item.reverse ? -10 : 10), item.rotation],
      }}
      transition={{
        duration: item.duration,
        repeat: Infinity,
        ease: "easeInOut",
        delay: item.delay,
      }}
    >
      {item.emoji}
    </motion.div>
  );
}

export function FloatingElements() {
  const [items] = useState(() => generateFloatingItems());
  const [isMouseOnScreen, setIsMouseOnScreen] = useState(false);
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setIsMouseOnScreen(true);
    };

    const handleMouseLeave = () => {
      setIsMouseOnScreen(false);
      mouseX.set(-1000);
      mouseY.set(-1000);
    };

    const handleMouseEnter = () => {
      setIsMouseOnScreen(true);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [mouseX, mouseY]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {items.map((item, index) => (
        <FloatingEmoji
          key={index}
          item={item}
          mouseX={mouseX}
          mouseY={mouseY}
          isMouseOnScreen={isMouseOnScreen}
        />
      ))}
    </div>
  );
}

interface FloatingElementsLightProps {
  variant?: "hero" | "section";
}

export function FloatingElementsLight({ variant = "section" }: FloatingElementsLightProps) {
  const [isMouseOnScreen, setIsMouseOnScreen] = useState(false);
  const mouseX = useMotionValue(-1000);
  const mouseY = useMotionValue(-1000);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      setIsMouseOnScreen(true);
    };

    const handleMouseLeave = () => {
      setIsMouseOnScreen(false);
      mouseX.set(-1000);
      mouseY.set(-1000);
    };

    const handleMouseEnter = () => {
      setIsMouseOnScreen(true);
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("mouseenter", handleMouseEnter);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
      document.removeEventListener("mouseenter", handleMouseEnter);
    };
  }, [mouseX, mouseY]);

  const lightItems: FloatingItem[] = variant === "hero"
    ? [
        { emoji: "🐾", size: "text-9xl", position: { top: "5%", right: "2%" }, rotation: 15, delay: 0, yDistance: 40, xDistance: 15, opacity: 0.35, duration: 8, reverse: false },
        { emoji: "🦴", size: "text-7xl", position: { bottom: "15%", left: "5%" }, rotation: -30, delay: 1, yDistance: 35, xDistance: 12, opacity: 0.3, duration: 9, reverse: true },
        { emoji: "🐾", size: "text-6xl", position: { top: "45%", left: "8%" }, rotation: -25, delay: 0.5, yDistance: 28, xDistance: 10, opacity: 0.32, duration: 7, reverse: false },
        { emoji: "🐕", size: "text-5xl", position: { bottom: "35%", right: "12%" }, rotation: 10, delay: 1.5, yDistance: 22, xDistance: 8, opacity: 0.35, duration: 8, reverse: true },
      ]
    : [
        { emoji: "🐾", size: "text-7xl", position: { top: "5%", right: "3%" }, rotation: 20, delay: 0, yDistance: 30, xDistance: 12, opacity: 0.3, duration: 8, reverse: false },
        { emoji: "🦴", size: "text-5xl", position: { bottom: "10%", left: "8%" }, rotation: -22, delay: 0.5, yDistance: 25, xDistance: 10, opacity: 0.28, duration: 7, reverse: true },
        { emoji: "🐾", size: "text-4xl", position: { top: "55%", right: "15%" }, rotation: 35, delay: 1, yDistance: 18, xDistance: 8, opacity: 0.32, duration: 6, reverse: false },
      ];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {lightItems.map((item, index) => (
        <FloatingEmoji
          key={index}
          item={item}
          mouseX={mouseX}
          mouseY={mouseY}
          isMouseOnScreen={isMouseOnScreen}
        />
      ))}
    </div>
  );
}
