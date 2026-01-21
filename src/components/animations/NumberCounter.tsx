"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface NumberCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function NumberCounter({
  value,
  duration = 2,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: NumberCounterProps) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!isInView || hasAnimated.current) return;
    hasAnimated.current = true;

    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    const updateCount = () => {
      const now = Date.now();
      const progress = Math.min((now - startTime) / (duration * 1000), 1);

      // Easing function (ease out)
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = easeOutQuart * value;

      setCount(currentValue);

      if (now < endTime) {
        requestAnimationFrame(updateCount);
      } else {
        setCount(value);
      }
    };

    requestAnimationFrame(updateCount);
  }, [isInView, value, duration]);

  const displayValue = decimals > 0
    ? count.toFixed(decimals)
    : Math.round(count).toLocaleString();

  return (
    <span ref={ref} className={className}>
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
