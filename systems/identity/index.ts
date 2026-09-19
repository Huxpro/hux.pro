// =============================================================================
// Identity System — the identity card.
//
// Every commit on /works is signed by an identity — `<jsx@fb.com>`,
// `<@bytedance>` — and each identity holds one or more roles. Hovering a
// handle, a `Role:` field or a role row peeks that identity's card, the way
// a folded row peeks its media: a photo from that time, the handle, the
// company, the role and its tenure, the other roles under the same handle
// and what was signed with it. Where there is no pointer, a tap opens the
// same card as a sheet.
//
//   <IdentityHover identityId={byline.identityId} roleId={byline.roleId}>
//     {byline.handle}
//   </IdentityHover>
//
// Mount <IdentityCardProvider> in the root providers and <IdentityCard />
// once in the root layout.
// =============================================================================

export {
  IdentityCardProvider,
  useIdentityCard,
  useIdentityProfile,
  useOptionalIdentityCard,
} from "./provider";
export type { OpenIdentityCard } from "./provider";
export { IdentityCard } from "./components/identity-card";
export {
  IdentityHover,
  IdentityPeek,
  IDENTITY_PEEK_PANEL,
} from "./components/identity-hover";
export { IdentityProfileView } from "./components/identity-profile";
export { buildIdentityProfile } from "./lib/profile";
export type { IdentityProfile, ProfileRole, ProfileCount } from "./lib/profile";
