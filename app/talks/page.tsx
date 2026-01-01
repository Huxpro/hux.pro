import { getAllTalks } from "@/lib/mdx";
import { TalksList } from "./talks-list";

export default function TalksPage() {
  const talks = getAllTalks();

  return <TalksList talks={talks} />;
}
