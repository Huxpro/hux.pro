import { WeatherStudio } from "./view";

export const metadata = {
  title: "Atmosphere Studio | Hux.Pro",
  description: "The Atmosphere weather engine — any weather, any hour.",
  robots: { index: false, follow: false },
};

export default function WeatherStudioPage() {
  return <WeatherStudio />;
}
