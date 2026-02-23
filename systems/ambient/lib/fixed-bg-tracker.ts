/**
 * JS polyfill for `background-attachment: fixed`, which is unsupported on iOS.
 * Also handles viewport-relative soft-edging masks on any platform.
 *
 * One singleton instance handles ALL registered widget gradient overlays:
 *   - 1 set of event listeners (not N)
 *   - Batched reads then writes each frame (no layout thrashing)
 *   - Direct DOM style writes (zero React re-renders)
 *
 * Usage (from a useEffect):
 *   return fixedBgTracker.register(shellElement, overlayElement, {
 *     positionBackground: true,   // simulate background-attachment: fixed
 *     edgeMask: EDGE_FADE_MASK,   // viewport-relative mask-image
 *   });
 */

interface TrackerOptions {
  /** When true, set backgroundSize/Position to simulate fixed attachment. */
  positionBackground?: boolean;
  /** CSS mask-image value to apply with viewport-relative positioning. */
  edgeMask?: string;
}

interface TrackedEntry {
  shell: HTMLElement;
  overlay: HTMLElement;
  options: TrackerOptions;
}

class FixedBgTracker {
  private entries = new Set<TrackedEntry>();
  private rafId = 0;
  private listening = false;

  register(
    shell: HTMLElement,
    overlay: HTMLElement,
    options: TrackerOptions = {}
  ): () => void {
    const entry: TrackedEntry = { shell, overlay, options };
    this.entries.add(entry);

    if (!this.listening) this.startListening();
    this.updateEntry(entry);

    return () => {
      this.entries.delete(entry);
      if (this.entries.size === 0) this.stopListening();
    };
  }

  private flush = () => {
    this.rafId = 0;

    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const size = `${vw}px ${vh}px`;

    // Phase 1 — batch read (all forced layouts happen here, once)
    const measured = [...this.entries].map((entry) => ({
      entry,
      rect: entry.shell.getBoundingClientRect(),
    }));

    // Phase 2 — batch write (no interleaved reads → no layout thrashing)
    for (const { entry, rect } of measured) {
      const pos = `${-rect.left}px ${-rect.top}px`;
      this.applyStyles(entry, size, pos);
    }
  };

  private schedule = () => {
    if (!this.rafId) {
      this.rafId = requestAnimationFrame(this.flush);
    }
  };

  private updateEntry(entry: TrackedEntry) {
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const rect = entry.shell.getBoundingClientRect();
    const size = `${vw}px ${vh}px`;
    const pos = `${-rect.left}px ${-rect.top}px`;
    this.applyStyles(entry, size, pos);
  }

  private applyStyles(entry: TrackedEntry, size: string, pos: string) {
    const s = entry.overlay.style;
    const { positionBackground, edgeMask } = entry.options;

    if (positionBackground) {
      s.backgroundSize = size;
      s.backgroundPosition = pos;
      s.backgroundRepeat = "no-repeat";
    }

    if (edgeMask) {
      s.setProperty("-webkit-mask-image", edgeMask);
      s.maskImage = edgeMask;
      s.setProperty("-webkit-mask-size", size);
      s.maskSize = size;
      s.setProperty("-webkit-mask-position", pos);
      s.maskPosition = pos;
      s.setProperty("-webkit-mask-repeat", "no-repeat");
      s.maskRepeat = "no-repeat";
    }
  }

  private startListening() {
    this.listening = true;
    window.addEventListener("scroll", this.schedule, { passive: true });
    window.addEventListener("resize", this.schedule);
    window.visualViewport?.addEventListener("scroll", this.schedule);
    window.visualViewport?.addEventListener("resize", this.schedule);
  }

  private stopListening() {
    this.listening = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    window.removeEventListener("scroll", this.schedule);
    window.removeEventListener("resize", this.schedule);
    window.visualViewport?.removeEventListener("scroll", this.schedule);
    window.visualViewport?.removeEventListener("resize", this.schedule);
  }
}

export const fixedBgTracker = new FixedBgTracker();
