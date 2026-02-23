/**
 * Centralized scroll/resize tracker that simulates `background-attachment: fixed`
 * on iOS Safari where native support is broken.
 *
 * One singleton instance handles ALL registered widget gradient overlays:
 *   - 1 set of event listeners (not N)
 *   - Batched reads then writes each frame (no layout thrashing)
 *   - Direct DOM style writes (zero React re-renders)
 *
 * Usage (from a useEffect):
 *   return iosGradientTracker.register(shellElement, overlayElement);
 */

interface TrackedEntry {
  shell: HTMLElement;
  overlay: HTMLElement;
}

class IOSGradientTracker {
  private entries = new Set<TrackedEntry>();
  private rafId = 0;
  private listening = false;

  register(shell: HTMLElement, overlay: HTMLElement): () => void {
    const entry: TrackedEntry = { shell, overlay };
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
      entry.overlay.style.backgroundSize = size;
      entry.overlay.style.backgroundPosition = `${-rect.left}px ${-rect.top}px`;
      entry.overlay.style.backgroundRepeat = "no-repeat";
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

    entry.overlay.style.backgroundSize = `${vw}px ${vh}px`;
    entry.overlay.style.backgroundPosition = `${-rect.left}px ${-rect.top}px`;
    entry.overlay.style.backgroundRepeat = "no-repeat";
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

export const iosGradientTracker = new IOSGradientTracker();
