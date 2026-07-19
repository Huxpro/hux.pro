"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";

/**
 * Hosts an external web app in the same floating chrome as Lynx apps.
 * Some sites refuse iframes (X-Frame-Options / CSP); surface a fallback.
 */
export function WebPlayer({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          {title} blocked embedding in a window. Open it in a new tab instead.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-raised transition-colors hover:bg-muted"
        >
          <ExternalLink className="h-3.5 w-3.5 opacity-70" strokeWidth={2.25} />
          Open in browser
        </a>
      </div>
    );
  }

  return (
    <iframe
      key={url}
      src={url}
      title={title}
      className="h-full w-full border-0 bg-white"
      // Sandbox keeps the embed contained; allow scripts/forms/popups that
      // typical docs / demo sites need. Same-origin is not granted.
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
      referrerPolicy="no-referrer-when-downgrade"
      onError={() => setFailed(true)}
    />
  );
}
