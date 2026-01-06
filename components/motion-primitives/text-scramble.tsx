"use client";
import { motion, MotionProps } from "motion/react";
import { type JSX, useCallback, useEffect, useRef, useState } from "react";

export type TextScrambleProps = {
  children: string;
  duration?: number;
  speed?: number;
  characterSet?: string;
  as?: React.ElementType;
  className?: string;
  trigger?: boolean;
  onScrambleComplete?: () => void;
} & MotionProps;

const defaultChars =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

export function TextScramble({
  children,
  duration = 0.8,
  speed = 0.04,
  characterSet = defaultChars,
  className,
  as: Component = "p",
  trigger = true,
  onScrambleComplete,
  ...props
}: TextScrambleProps) {
  const MotionComponent = motion.create(
    Component as keyof JSX.IntrinsicElements
  );
  const [displayText, setDisplayText] = useState(children);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetTextRef = useRef(children);

  // Cleanup function to clear interval
  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const scrambleTo = useCallback(
    (targetText: string) => {
      // Always cleanup previous animation first
      cleanup();

      // Update target ref
      targetTextRef.current = targetText;

      const steps = duration / speed;
      let step = 0;

      intervalRef.current = setInterval(() => {
        // Check if target changed during animation
        if (targetTextRef.current !== targetText) {
          cleanup();
          return;
        }

        let scrambled = "";
        const progress = step / steps;

        for (let i = 0; i < targetText.length; i++) {
          if (targetText[i] === " ") {
            scrambled += " ";
            continue;
          }

          if (progress * targetText.length > i) {
            scrambled += targetText[i];
          } else {
            scrambled +=
              characterSet[Math.floor(Math.random() * characterSet.length)];
          }
        }

        setDisplayText(scrambled);
        step++;

        if (step > steps) {
          cleanup();
          setDisplayText(targetText);
          onScrambleComplete?.();
        }
      }, speed * 1000);
    },
    [duration, speed, characterSet, cleanup, onScrambleComplete]
  );

  // Handle children changes - scramble to new text
  useEffect(() => {
    if (!trigger) {
      setDisplayText(children);
      return;
    }
    scrambleTo(children);
    return cleanup;
  }, [children, trigger, scrambleTo, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return (
    <MotionComponent className={className} {...props}>
      {displayText}
    </MotionComponent>
  );
}
