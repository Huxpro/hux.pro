import type { Meta, StoryObj } from "@storybook/react-vite";
import { syncChrome } from "../src";

const COLOURS = ["#000000", "#1a1a1a", "#ffffff", "#c1440e", "#2d5a3d"];

/** Calls `syncChrome` directly. Open on an iPhone to watch the bezel morph and Safari's bars follow. */
function Demo() {
  return (
    <div style={{ padding: 24, fontFamily: "system-ui, sans-serif", display: "grid", gap: 12 }}>
      {COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => syncChrome(c, { band: 0, radius: 16 })}
          style={{ padding: 12, borderRadius: 12, border: "1px solid #ccc", background: c, color: c === "#ffffff" ? "#000" : "#fff" }}
        >
          {`syncChrome("${c}", { band: 0, radius: 16 })`}
        </button>
      ))}
    </div>
  );
}

const meta = { title: "Chrome", component: Demo } satisfies Meta<typeof Demo>;
export default meta;
export const Sync: StoryObj<typeof meta> = {};
