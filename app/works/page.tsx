import { getLogData } from "@/lib/log-server";
import { sortTagsByDate, sortCommitsByDate, isCommitListed } from "@/lib/log";
import { WorksView } from "./view";

export const metadata = {
  title: "Works | Hux.Pro",
  description:
    "Commit history — professional work as git log, tags marking each chapter.",
};

export default function WorksPage() {
  const { tags, commits } = getLogData();
  const listedCommits = commits.filter(isCommitListed);

  // Sort tags by date (most recent first)
  const sortedTags = sortTagsByDate(tags);

  // Build the data structure for the view
  const data = sortedTags.map((tag) => ({
    tag,
    commits: sortCommitsByDate(
      listedCommits.filter((commit) => commit.tagId === tag.id)
    ),
  }));

  return <WorksView data={data} />;
}
