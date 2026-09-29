// Client code needs only the host; MDX renders magic links through
// ./server (ServerMagicLink, ServerBadge), which reads what they name.
export { MagicLinkHost } from "./magic-link";
// A badge's icon without the pill, for a surface that lists the things the
// badges name — /works prints each project beside it.
export { BadgeMark } from "./magic-link";
export { commitBadge } from "./resolve";
