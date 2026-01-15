"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SystemNav } from "@/components/ui/system-nav";
import type { PromptsData, Quote, Principle, Person } from "@/lib/prompts";
import { cn } from "@/lib/utils";

// Animation variants for expandable content
const expandVariants = {
  initial: { 
    height: 0, 
    opacity: 0,
  },
  animate: { 
    height: "auto", 
    opacity: 1,
    transition: {
      height: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
      opacity: { duration: 0.2, delay: 0.05 }
    }
  },
  exit: { 
    height: 0, 
    opacity: 0,
    transition: {
      height: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] as const },
      opacity: { duration: 0.1 }
    }
  }
};

// Stagger children animation
const contentVariants = {
  initial: { opacity: 0, y: -8 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.2, ease: "easeOut" as const }
  },
  exit: { 
    opacity: 0, 
    y: -4,
    transition: { duration: 0.1 }
  }
};

interface PromptViewProps {
  data: PromptsData;
}

// XML-style tag component
function XmlTag({
  children,
  attributes,
  closing = false,
  className,
}: {
  children: string;
  attributes?: Record<string, string>;
  closing?: boolean;
  className?: string;
}) {
  return (
    <span className={cn(
      "font-mono text-xs text-muted-foreground/60 select-none transition-opacity duration-200",
      className
    )}>
      {closing ? "</" : "<"}
      {children}
      {attributes &&
        Object.entries(attributes).map(([key, value]) => (
          <span key={key}>
            {" "}
            <span className="text-muted-foreground/40">{key}</span>=
            <span className="text-muted-foreground/50">&quot;{value}&quot;</span>
          </span>
        ))}
      {">"}
    </span>
  );
}

// Subtle divider
function Divider() {
  return (
    <div className="my-4 flex items-center">
      <div className="flex-1 border-t border-dashed border-muted-foreground/20" />
    </div>
  );
}

// Quote item component
function QuoteItem({ quote }: { quote: Quote }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        "group py-3 cursor-pointer transition-colors duration-200",
        "hover:bg-foreground/[0.02] -mx-4 px-4 rounded-lg"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2">
        <XmlTag className={cn("opacity-0 group-hover:opacity-100", isExpanded && "opacity-100")}>quote</XmlTag>
        {quote.commentary && (
          <motion.span
            className={cn("text-muted-foreground/40 text-xs select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200", isExpanded && "opacity-100")}
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            ›
          </motion.span>
        )}
      </div>

      <div className="mt-2 mb-2">
        {/* Main quote - serif, large */}
        <blockquote className="font-serif text-xl sm:text-2xl text-foreground leading-relaxed italic">
          &ldquo;{quote.text}&rdquo;
        </blockquote>

        {/* Attribution */}
        <p className="mt-3 text-sm text-muted-foreground">
          {quote.author}
          {quote.source && (
            <span className="text-muted-foreground/60"> · {quote.source}</span>
          )}
        </p>

        {/* Expandable detail */}
        <AnimatePresence>
          {isExpanded && quote.commentary && (
            <motion.div
              variants={expandVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="overflow-hidden"
            >
              <motion.div variants={contentVariants}>
                <Divider />
                <p className="text-sm text-muted-foreground/80 leading-relaxed">
                  {quote.commentary}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <XmlTag closing className={cn("opacity-0 group-hover:opacity-100", isExpanded && "opacity-100")}>quote</XmlTag>
    </div>
  );
}

// Principle/Belief item component
function PrincipleItem({ principle }: { principle: Principle }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const attributes = principle.topic ? { on: principle.topic } : undefined;
  const hasExpandableContent = principle.shapedBy || principle.reasoning;

  return (
    <div
      className={cn(
        "group py-3 cursor-pointer transition-colors duration-200",
        "hover:bg-foreground/[0.02] -mx-4 px-4 rounded-lg"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2">
        <XmlTag attributes={attributes} className={cn("opacity-0 group-hover:opacity-100", isExpanded && "opacity-100")}>belief</XmlTag>
        {hasExpandableContent && (
          <motion.span
            className={cn("text-muted-foreground/40 text-xs select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200", isExpanded && "opacity-100")}
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            ›
          </motion.span>
        )}
      </div>

      <div className="mt-2 mb-2">
        {/* Main statement - serif, large */}
        <p className="font-serif text-xl sm:text-2xl text-foreground leading-relaxed">
          {principle.statement}
        </p>

        {/* Expandable detail */}
        <AnimatePresence>
          {isExpanded && hasExpandableContent && (
            <motion.div
              variants={expandVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="overflow-hidden"
            >
              <motion.div variants={contentVariants}>
                <Divider />
                {principle.shapedBy && principle.shapedBy.length > 0 && (
                  <p className="text-xs font-mono text-muted-foreground/60 mb-2">
                    shaped by:{" "}
                    <span className="text-muted-foreground/80">
                      {principle.shapedBy.join(", ")}
                    </span>
                  </p>
                )}
                {principle.reasoning && (
                  <p className="text-sm text-muted-foreground/80 leading-relaxed">
                    {principle.reasoning}
                  </p>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <XmlTag closing className={cn("opacity-0 group-hover:opacity-100", isExpanded && "opacity-100")}>belief</XmlTag>
    </div>
  );
}

// Person item component
function PersonItem({ person }: { person: Person }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasExpandableContent = person.admire || person.links;

  return (
    <div
      className={cn(
        "group py-3 cursor-pointer transition-colors duration-200",
        "hover:bg-foreground/[0.02] -mx-4 px-4 rounded-lg"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2">
        <XmlTag className={cn("opacity-0 group-hover:opacity-100", isExpanded && "opacity-100")}>person</XmlTag>
        {hasExpandableContent && (
          <motion.span
            className={cn("text-muted-foreground/40 text-xs select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200", isExpanded && "opacity-100")}
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            ›
          </motion.span>
        )}
      </div>

      <div className="mt-2 mb-2">
        {/* Name - serif, large */}
        <p className="font-serif text-xl sm:text-2xl text-foreground">
          {person.name}
        </p>

        {/* Context */}
        {person.context && (
          <p className="mt-1 text-sm text-muted-foreground">
            {person.context}
          </p>
        )}

        {/* Expandable detail */}
        <AnimatePresence>
          {isExpanded && hasExpandableContent && (
            <motion.div
              variants={expandVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="overflow-hidden"
            >
              <motion.div variants={contentVariants}>
                <Divider />
                {person.admire && person.admire.length > 0 && (
                  <ul className="space-y-1 mb-4">
                    {person.admire.map((point, i) => (
                      <motion.li
                        key={i}
                        className="text-sm text-muted-foreground/80 flex items-start gap-2"
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                      >
                        <span className="text-muted-foreground/40">·</span>
                        {point}
                      </motion.li>
                    ))}
                  </ul>
                )}
                {person.links && person.links.length > 0 && (
                  <div className="flex flex-wrap gap-3">
                    {person.links.map((link, i) => (
                      <motion.a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs font-mono text-muted-foreground hover:text-foreground underline underline-offset-2 decoration-muted-foreground/30 hover:decoration-foreground transition-colors"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 + i * 0.05, duration: 0.2 }}
                      >
                        {link.label}
                      </motion.a>
                    ))}
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <XmlTag closing className={cn("opacity-0 group-hover:opacity-100", isExpanded && "opacity-100")}>person</XmlTag>
    </div>
  );
}

// Footer meta component
function PromptFooter({ meta }: { meta: PromptsData["meta"] }) {
  return (
    <div className="mt-20 py-4 px-4 rounded-lg border border-dashed border-muted-foreground/20">
      <div className="font-mono text-xs text-muted-foreground/50 space-y-1">
        <div>
          tokens: <span className="text-muted-foreground/70">{meta.tokenCount}</span>
        </div>
        <div>
          last updated: <span className="text-muted-foreground/70">{meta.lastUpdated}</span>
        </div>
        <div>
          model: <span className="text-muted-foreground/70">{meta.model}</span>
        </div>
      </div>
    </div>
  );
}

export function PromptView({ data }: PromptViewProps) {
  return (
    <main className="mx-auto max-w-[680px] px-6 pt-24 pb-32">
      {/* Back link - System UI */}
      <SystemNav href="/" path="λhux" className="mb-16" />

      {/* Header */}
      <header className="mb-12">
        <h1 className="font-serif text-3xl sm:text-4xl text-foreground tracking-tight">
          System Prompts
        </h1>
      </header>

      {/* System wrapper */}
      <div className="relative">
        <XmlTag>system</XmlTag>

        <div className="py-4 space-y-2">
          {/* Quotes */}
          {data.quotes.map((quote) => (
            <QuoteItem key={quote.id} quote={quote} />
          ))}

          {/* Principles */}
          {data.principles.map((principle) => (
            <PrincipleItem key={principle.id} principle={principle} />
          ))}

          {/* People */}
          {data.people.map((person) => (
            <PersonItem key={person.id} person={person} />
          ))}
        </div>

        <XmlTag closing>system</XmlTag>
      </div>

      {/* Footer meta */}
      <PromptFooter meta={data.meta} />
    </main>
  );
}
