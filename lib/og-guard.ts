import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * What the runtime crawl (`/api/og`) may request on a visitor's behalf: a
 * public web page, and nothing on the server's own network. The URL comes
 * from whoever calls the route, so without this the crawler is a way into
 * localhost, the cloud metadata address, or a private range.
 *
 * Checked for the URL and again for every redirect (`fetchOG`'s `guard`).
 * A name is resolved and every address it answers with must be public. The
 * fetch resolves it again, so a name that changes its answer in between (DNS
 * rebinding) is not caught here; the route's cache and timeout bound what
 * that could reach.
 */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`refused: ${url.protocol} is not a web page`);
  }
  if (url.username || url.password) throw new Error("refused: credentials in URL");
  if (url.port && url.port !== "80" && url.port !== "443") {
    throw new Error(`refused: port ${url.port}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error(`refused: ${host}`);
  }
  const addresses = isIP(host)
    ? [host]
    : (await lookup(host, { all: true, verbatim: true })).map((a) => a.address);
  if (!addresses.length) throw new Error(`refused: ${host} does not resolve`);
  for (const address of addresses) {
    if (!isPublicAddress(address)) throw new Error(`refused: ${host} is not public`);
  }
}

/** Whether an IP address is on the public internet. */
export function isPublicAddress(address: string): boolean {
  const v = isIP(address);
  if (v === 4) return isPublicV4(address);
  if (v === 6) {
    const a = address.toLowerCase();
    // An IPv4 address written as IPv6 is that IPv4 address.
    const mapped = a.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPublicV4(mapped[1]);
    if (a === "::" || a === "::1") return false;
    const first = parseInt(a.split(":")[0] || "0", 16);
    if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
    if ((first & 0xff00) === 0xff00) return false; // ff00::/8 multicast
    return true;
  }
  return false;
}

function isPublicV4(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false; // this, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0) return false; // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}
