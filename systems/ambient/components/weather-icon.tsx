"use client";

import { WEATHER_CONDITIONS, type WeatherCondition } from "../lib/weather";
import { cn } from "@/lib/utils";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
} from "lucide-react";

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
    case "CloudSun":
      return isDay ? <CloudSun {...iconProps} /> : <Cloud {...iconProps} />;
    case "Cloud":
      return <Cloud {...iconProps} />;
    case "CloudDrizzle":
      return <CloudDrizzle {...iconProps} />;
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
