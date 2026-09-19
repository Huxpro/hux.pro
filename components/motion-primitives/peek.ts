/**
 * Unified content width for every hover-peek surface — link card, video /
 * image poster, writing card, details fallback, and the stacked deck. A
 * cursor-following preview wants to read clearly without feeling like a
 * modal: 24rem / 384px fits a 16:9 poster (384×216) and a comfortable text
 * measure, and reads as roomy for an OG card. One width → the peeks feel
 * like one system. (Matches the `sm` step of the media size scale.)
 *
 * Kept in a motion-free module so commit cards on the home grid can share
 * the width without pulling `magnetic-preview` (and `motion/react`) in.
 */
export const PEEK_W = "w-96"; // 24rem · 384px
