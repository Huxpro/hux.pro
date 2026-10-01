"use client";

import { PromptToolbar } from "@/components/prompt/prompt-toolbar";
import { WorksToolbar } from "@/components/log/works-toolbar";
import { FILTERABLE_COMMIT_TYPES, type FilterableCommitType } from "@/lib/log";
import { DEFAULT_FORM, toggleType, type WorksForm } from "@/lib/log-view";
import {
  PROMPT_KINDS,
  PROMPT_TOPICS,
  toggleKind,
  toggleTopic,
  type PromptKind,
  type PromptTopic,
} from "@/lib/prompt-view";
import { useLocale } from "@/services";
import { useState } from "react";

// The pages' own toolbars, on the lab page: the real components with sample
// facets and their own state, so a chip still takes a tap and the row still
// scrolls — only the counts are made up.

const KIND_COUNTS = [20, 5];
const TOPIC_COUNTS = [4, 4, 5];
const TYPE_COUNTS = [12, 9, 31, 6, 4];

export function SamplePromptBar() {
  const { locale } = useLocale();
  const [kinds, setKinds] = useState<PromptKind[]>([]);
  const [topics, setTopics] = useState<PromptTopic[]>([]);
  return (
    <PromptToolbar
      locale={locale}
      kindFacets={PROMPT_KINDS.map((kind, i) => ({ kind, count: KIND_COUNTS[i] ?? 1 }))}
      topicFacets={PROMPT_TOPICS.map((topic, i) => ({ topic, count: TOPIC_COUNTS[i] ?? 1 }))}
      activeKinds={kinds}
      activeTopics={topics}
      onToggleKind={(k) => setKinds((l) => toggleKind(l, k))}
      onToggleTopic={(t) => setTopics((l) => toggleTopic(l, t))}
      onClear={() => {
        setKinds([]);
        setTopics([]);
      }}
    />
  );
}

export function SampleWorksBar() {
  const { locale } = useLocale();
  const [active, setActive] = useState<FilterableCommitType[]>([]);
  const [form, setForm] = useState<WorksForm>(DEFAULT_FORM);
  return (
    <WorksToolbar
      locale={locale}
      facets={FILTERABLE_COMMIT_TYPES.map((type, i) => ({ type, count: TYPE_COUNTS[i] ?? 1 }))}
      active={active}
      onToggleType={(t) => setActive((l) => toggleType(l, t))}
      onClearTypes={() => setActive([])}
      form={form}
      onFormChange={setForm}
      chapters={[]}
    />
  );
}
