// What the window, its edge and the tide tell the moments each frame.

export type Box = { x: number; y: number; width: number; height: number };

/** Which way the moments go: up through a tall window, or right to left through a wide one. */
export type Axis = "up" | "across";

export type WindowOut = {
  box: Box;
  axis: Axis;
  /** A row's height now, px, and that as a share of a full row. */
  row: number;
  scale: number;
  /** How many moments it holds before the oldest reaches the edge. */
  held: number;
  warmth: number;
  presence: number;
  ink: string;
};

export type EdgeOut = {
  rect: [number, number, number, number];
  /** Where a moment goes to dust, px along the window's axis (from the top, or from the left). */
  at: number;
  erode: number;
  shed: number;
  presence: number;
  /** The moments it wears, for the inspector. */
  moments: string;
};

export type TideOut = { box: Box; since: number; stagger: number };

/** Where one speck of dust is born, and its colour. */
export type Speck = { x: number; y: number; color: string };
