import { jekyllRedirects } from "../jekyll-redirects";
import { WORKS_READINGS } from "../works-readings";

type Env = { ASSETS: { fetch(request: Request): Promise<Response> }; AI_API_ORIGIN?: string };
const migrated = new Map(jekyllRedirects.map((r) => [r.source, r.destination]));
const metadata = new Set(["opengraph-image", "twitter-image", "icon", "apple-icon"]);

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, "") || "/";
    const redirect = (destination: string, status = 307) => {
      const target = new URL(destination, url);
      if (!target.search) target.search = url.search;
      return new Response(null, { status, headers: { Location: target.href, "Cache-Control": "private, no-store" } });
    };
    const asset = (pathname: string) => {
      const target = new URL(url);
      target.pathname = pathname;
      return env.ASSETS.fetch(new Request(target, request));
    };
    if (path === "/api/chat" || path === "/api/voice") {
      const allowed = path === "/api/chat" ? ["POST"] : ["GET", "POST"];
      if (!allowed.includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { Allow: allowed.join(", ") } });
      if (!env.AI_API_ORIGIN) return Response.json({ error: "AI API origin is not configured" }, { status: 503 });
      // Keep model credentials and Vercel OIDC in the existing Vercel API.
      // Stream both directions: do not buffer chat SSE or voice uploads.
      const upstream = new URL(path + url.search, env.AI_API_ORIGIN);
      if (upstream.protocol !== "https:" || upstream.origin === url.origin) return new Response("Invalid AI origin", { status: 503 });
      const headers = new Headers();
      for (const name of ["content-type", "accept", "x-voice-model"]) {
        const value = request.headers.get(name);
        if (value) headers.set(name, value);
      }
      try {
        const response = await fetch(upstream, {
          method: request.method, headers, body: request.body,
          signal: request.signal, redirect: "manual",
        });
        if (response.status >= 300 && response.status < 400) return Response.json({ error: "AI upstream redirected unexpectedly" }, { status: 502 });
        const result = new Response(response.body, response);
        result.headers.set("Cache-Control", "no-store");
        result.headers.delete("Set-Cookie");
        return result;
      } catch {
        return Response.json({ error: "AI service is temporarily unavailable" }, { status: 502 });
      }
    }
    if (path.startsWith("/api/")) return new Response("Not found", { status: 404 });
    const legacy = migrated.get(path);
    if (legacy) return redirect(legacy, 308);
    if (/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+$/.test(path)) return redirect(`https://huxpro.github.io${path}/`, 302);
    if (path === "/bezel" || path.startsWith("/bezel/")) return redirect(path.replace(/^\/bezel/, "/vitre"), 308);
    if (path === "/editor") return redirect("/lab/works", 308);
    if (path === "/editor/theater-variants") return redirect("/lab", 308);
    if (path.startsWith("/editor/")) return redirect(path.replace(/^\/editor/, "/lab"), 308);
    if (path === "/vitre/index.html") return asset("/vitre/");
    if (path === "/vitre") {
      if (!/(iPhone|iPod|Android|Mobile)/.test(request.headers.get("user-agent") ?? "")) return redirect("/lab/vitre");
      // Pages redirects index.html to its directory. Fetch the directory
      // through ASSETS so the mobile demo does not redirect back to itself.
      return asset("/vitre/");
    }
    const reading = path.match(/^\/works\/(talk|project)$/)?.[1];
    if (reading) return redirect(`/works?type=${reading}`);
    if (path === "/works" && WORKS_READINGS.includes(url.searchParams.get("type") as typeof WORKS_READINGS[number])) {
      return asset(`/works/${url.searchParams.get("type")}`);
    }
    if (/^\/(writing|docs)\/.+/.test(path)) {
      const last = path.split("/").pop()!;
      // Static export RSC payloads and metadata files are assets, not pages.
      if (!['en', 'zh'].includes(last) && !metadata.has(last) && !last.includes('.')) {
        const cookie = request.headers.get("cookie")?.match(/(?:^|;\s*)locale=(en|zh)(?:;|$)/)?.[1] ?? "en";
        return redirect(`${path}/${cookie}`);
      }
    }
    const response = await env.ASSETS.fetch(request);
    if (path.split("/").pop() === "opengraph-image" && response.ok) {
      const image = new Response(response.body, response);
      image.headers.set("Content-Type", "image/png");
      return image;
    }
    return response;
  },
};

export default worker;
