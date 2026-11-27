import { getSessionId } from "./http";
import type { PagesContext } from "./types";

const BOOTSTRAP_OVERLAY =
  /<div\b(?=[^>]*\bid=["']revit-session-bootstrap["'])[^>]*>/i;
const HIDDEN_ATTRIBUTE = /\s+hidden(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/i;

export async function onRequest(context: PagesContext): Promise<Response> {
  const { request, next } = context;
  if (!next) {
    return new Response("Static asset handler is unavailable.", {
      status: 500,
    });
  }

  if (request.method !== "GET" || !getSessionId(request)) {
    return next();
  }

  // Avoid a browser 304 for a cached, cookie-free copy of the static page.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("If-None-Match");
  requestHeaders.delete("If-Modified-Since");
  const assetRequest = new Request(request, { headers: requestHeaders });
  const assetResponse = await next(assetRequest);

  if (
    !assetResponse.ok ||
    !assetResponse.headers.get("Content-Type")?.includes("text/html")
  ) {
    return assetResponse;
  }

  const html = await assetResponse.clone().text();
  let revealedOverlay = false;
  const personalizedHtml = html.replace(BOOTSTRAP_OVERLAY, (tag) => {
    const visibleTag = tag.replace(HIDDEN_ATTRIBUTE, "");
    revealedOverlay = visibleTag !== tag;
    return visibleTag;
  });

  if (!revealedOverlay) {
    return assetResponse;
  }

  const headers = new Headers(assetResponse.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  for (const header of [
    "Accept-Ranges",
    "Content-Encoding",
    "Content-Length",
    "Content-MD5",
    "ETag",
    "Last-Modified",
  ]) {
    headers.delete(header);
  }

  return new Response(personalizedHtml, {
    status: assetResponse.status,
    statusText: assetResponse.statusText,
    headers,
  });
}
