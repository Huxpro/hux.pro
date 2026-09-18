// =============================================================================
// Identity System — the identity card.
//
// Every commit on /works is signed by an identity — `<jsx@fb.com>`,
// `<@bytedance>` — and each identity holds one or more roles. Pressing a
// handle, a `Role:` field or a role row opens that identity's card: a photo
// from that time, the handle, the company, the role and its tenure, the other
// roles under the same handle and what was signed with it. A sheet on a
// phone, a hovercard-style popover off the pressed element on a desktop.
//
//   const card = useOptionalIdentityCard();
//   card?.open({ identityId: byline.identityId, roleId: byline.roleId, anchor: e.currentTarget });
//
// Mount <IdentityCardProvider> in the root providers and <IdentityCard />
// once in the root layout.
// =============================================================================

export {
  IdentityCardProvider,
  useIdentityCard,
  useOptionalIdentityCard,
} from "./provider";
export type { OpenIdentityCard } from "./provider";
export { IdentityCard } from "./components/identity-card";
export { buildIdentityProfile } from "./lib/profile";
export type { IdentityProfile, ProfileRole, ProfileCount } from "./lib/profile";
