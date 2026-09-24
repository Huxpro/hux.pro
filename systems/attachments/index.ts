// =============================================================================
// Attachments System — one door for everything a commit attaches.
//
// A commit on /works carries media: link cards, videos, slide decks, images,
// social widgets. Each used to open its own way — a video to the theater, a
// deck to a lightbox of its own, a card to a new tab, a cover on a phone to
// nothing at all. This system holds one decision instead (lib/policy.ts):
//
//   phone     everything opens the attachment surface — a bottom sheet paging
//             through the commit's attachments, each with its native action.
//   desktop   a video or a deck goes to the theater's stage; a link card to an
//             in-app browser window (systems/windows), or a tab when the page
//             refuses to be framed; an image to the lightbox (zoom and pan);
//             a social widget to the surface in its desktop shape.
//
//   const { open } = useAttachments();
//   open(attachmentSetFor(commit, locale), items.indexOf(media));
//
// Mount <AttachmentProvider> inside the theater and window providers, and
// <AttachmentSurface /> and <ImageLightbox /> once in the root layout.
// =============================================================================

export {
  AttachmentProvider,
  useAttachments,
  useOptionalAttachments,
} from "./provider";
export type {
  AttachmentSession,
  LightboxSession,
  AttachmentsContextValue as AttachmentsApi,
} from "./provider";
export { AttachmentSurface } from "./components/attachment-surface";
export { ImageLightbox } from "./components/image-lightbox";
export { attachmentSetFor } from "./lib/set";
export {
  homeFor,
  nativeHomeFor,
  linkTarget,
  isInternalLink,
  leavesSite,
} from "./lib/policy";
export type { HomeContext } from "./lib/policy";
export type { AttachmentHome, AttachmentSet } from "./lib/types";
