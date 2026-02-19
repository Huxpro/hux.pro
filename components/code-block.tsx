"use client";

import { cn } from "@/lib/utils";
import { Check, Copy } from "lucide-react";
import * as React from "react";

interface CodeBlockProps extends React.ComponentPropsWithoutRef<"pre"> {
  "data-language"?: string;
  "data-theme"?: string;
}

export function CodeBlock({
  children,
  className,
  "data-language": language,
  "data-theme": theme,
  ...props
}: CodeBlockProps) {
  const [isCopied, setIsCopied] = React.useState(false);
  const preRef = React.useRef<HTMLPreElement>(null);

  const copyToClipboard = React.useCallback(async () => {
    if (!preRef.current) return;

    // Get the text content from the code element
    const codeElement = preRef.current.querySelector("code");
    if (!codeElement) return;

    const code = codeElement.innerText;

    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code", err);
    }
  }, []);

  return (
    <div className="relative group my-6">
      {/* Language badge */}
      {language && (
        <div className="absolute top-0 right-0 px-3 py-1 text-xs font-mono text-muted-foreground bg-muted/50 rounded-bl-lg rounded-tr-lg border-b border-l border-border select-none">
          {language}
        </div>
      )}

      {/* Copy button */}
      <button
        onClick={copyToClipboard}
        className={cn(
          "absolute top-2 right-2 p-2 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100",
          "hover:bg-muted/80 text-muted-foreground hover:text-foreground",
          // Adjust position if language badge is present
          language ? "top-8 right-2" : "top-2 right-2"
        )}
        aria-label="Copy code"
      >
        {isCopied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </button>

      <pre
        ref={preRef}
        {...props}
        data-theme={theme}
        data-language={language}
        className={cn(
          "overflow-x-auto rounded-lg border border-border p-4 text-sm leading-normal",
          // Remove hardcoded background, use CSS variables handled in globals.css
          className
        )}
      >
        {children}
      </pre>
    </div>
  );
}
