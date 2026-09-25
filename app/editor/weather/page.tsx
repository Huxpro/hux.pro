import { WeatherStudio } from "./view";

export const metadata = {
  title: "Atmosphere Studio",
  robots: { index: false, follow: false },
};

export default function WeatherStudioPage() {
  return <WeatherStudio />;
}
