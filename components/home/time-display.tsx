"use client";

import { useLocale } from "@/components/providers";
import { useEffect, useState } from "react";

export function TimeDisplay() {
  const { locale } = useLocale();
  const [timeText, setTimeText] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      
      let period = "";
      if (locale === "en") {
        if (hour >= 5 && hour < 12) period = "morning";
        else if (hour >= 12 && hour < 17) period = "afternoon";
        else if (hour >= 17 && hour < 22) period = "evening";
        else period = "late night";
      } else {
        if (hour >= 5 && hour < 9) period = "清晨";
        else if (hour >= 9 && hour < 12) period = "上午";
        else if (hour >= 12 && hour < 14) period = "中午";
        else if (hour >= 14 && hour < 18) period = "下午";
        else if (hour >= 18 && hour < 23) period = "晚上";
        else period = "深夜";
      }

      const month = now.toLocaleDateString(locale === "en" ? "en-US" : "zh-CN", { 
        month: "long" 
      }).toLowerCase();
      
      if (locale === "en") {
        setTimeText(`${period}. ${month}.`);
      } else {
        setTimeText(`${month}，${period}。`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [locale]);

  if (!timeText) return null; // Avoid hydration mismatch by waiting for client side

  return (
    <div className="text-muted-foreground font-serif italic text-lg animate-in fade-in duration-1000">
      {timeText}
    </div>
  );
}
