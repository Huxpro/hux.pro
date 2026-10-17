// The screens every dream in the Intent Lab is seen on, and the one index
// an intent may cross over along.

/** A screen a dream is seen on: its size in CSS px. */
export interface Screen {
  id: string;
  w: number;
  h: number;
}

export const SCREENS: Screen[] = [
  { id: "phone", w: 390, h: 844 },
  { id: "tablet", w: 820, h: 1180 },
  { id: "square", w: 800, h: 800 },
  { id: "laptop", w: 1440, h: 900 },
  { id: "landscape", w: 844, h: 390 },
  { id: "wide", w: 2560, h: 1080 },
];

/** How tall a screen is for its width: the index an intent crosses over along. */
export const tallness = (s: Screen) => s.h / s.w;
