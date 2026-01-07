"use client";

import { WEATHER_CONDITIONS, type WeatherCondition } from "@/lib/ambient/weather";
import { cn } from "@/lib/utils";
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Moon,
  Sun,
} from "lucide-react";

/**
 * Small presentational component used by the weather widget and debug previews.
 * Keeps icon mapping in one place while the condition metadata lives in `WEATHER_CONDITIONS`.
 */
export function WeatherIcon({
  condition,
  isDay,
  className,
}: {
  condition: WeatherCondition;
  isDay: boolean;
  className?: string;
}) {
  const iconKey = WEATHER_CONDITIONS[condition].icon;
  const iconProps = { className: cn("h-5 w-5", className) };

  switch (iconKey) {
    case "Sun":
      return isDay ? <Sun {...iconProps} /> : <Moon {...iconProps} />;
    case "Cloud":
      return <Cloud {...iconProps} />;
    case "CloudFog":
      return <CloudFog {...iconProps} />;
    case "CloudRain":
      return <CloudRain {...iconProps} />;
    case "CloudSnow":
      return <CloudSnow {...iconProps} />;
    case "CloudLightning":
      return <CloudLightning {...iconProps} />;
  }
}
