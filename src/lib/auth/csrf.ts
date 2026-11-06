/**
 * Cross-site request check for cookie-setting / cookie-using JSON endpoints (login, logout).
 *
 * Route handlers accept any Content-Type, so a cross-site `<form enctype="text/plain">` can
 * POST a JSON-looking body. SameSite=Lax stops the session cookie from being SENT on such a
 * request, but not a Set-Cookie on the response, so without this check an attacker could log a
 * victim into the attacker's account (login CSRF) or burn their OTP quota.
 *
 * Browsers send `Sec-Fetch-Site` on every request; older ones send `Origin` on POST.
 * Non-browser clients (curl, server-to-server tests) send neither and are allowed.
 */
export function isCrossSiteRequest(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = headers.get("origin");
  if (!origin || origin === "null") return origin === "null";
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export function crossSiteResponse(): Response {
  return Response.json({ error: "FORBIDDEN" }, { status: 403 });
}
