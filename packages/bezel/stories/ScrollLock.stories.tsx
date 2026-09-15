import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  Bezel,
  BEZEL_INSET,
  BEZEL_LAYER_ATTRIBUTE,
  useScrollLock,
  useScrollLocked,
  type BezelScroll,
} from "../src";
import { Backdrop, Page } from "./page";

/** A component somewhere in the page that asks for the page to stop scrolling. */
function Sheet({ open }: { open: boolean }) {
  useScrollLock(open);
  return open ? (
    <div style={{ padding: 12, borderRadius: 12, background: "#fff", marginBottom: 16 }}>
      A sheet is open, holding a scroll lock.
    </div>
  ) : null;
}

function Demo({ scroll }: { scroll: BezelScroll }) {
  const [open, setOpen] = useState(false);
  const locked = useScrollLocked();
  return (
    <Bezel
      enabled
      color="#000000"
      ground="#ffffff"
      scroll={scroll}
      backdrop={<Backdrop layerProps={{ [BEZEL_LAYER_ATTRIBUTE]: "" }} style={BEZEL_INSET} />}
    >
      <Page>
        <div style={{ position: "sticky", top: 12, zIndex: 1 }}>
          <button type="button" onClick={() => setOpen((o) => !o)} style={{ padding: "8px 12px" }}>
            {open ? "Close sheet" : "Open sheet"}
          </button>
          <span style={{ marginLeft: 12, fontSize: 12 }}>
            useScrollLocked(): {String(locked)}
          </span>
        </div>
        <Sheet open={open} />
      </Page>
    </Bezel>
  );
}

const meta = {
  title: "Scroll lock",
  component: Demo,
  args: { scroll: "container" },
  argTypes: { scroll: { control: "inline-radio", options: ["window", "container"] } },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

/** `useScrollLock(open)` from any component freezes page scroll in either mode. */
export const Container: Story = {};
export const Window: Story = { args: { scroll: "window" } };
