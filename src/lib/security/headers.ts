/**
 * Security headers for every HTML/document response of the app.
 *
 * CSP is deliberately shipped in Report-Only mode first (Gate A3): the app and
 * the Lovable preview both rely on inline styles and inline bootstrap scripts,
 * so an enforcing policy is only switched on after the report phase shows no
 * legitimate violation. Everything else is enforced immediately.
 */

const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://lovable.dev https://*.lovable.dev",
  "connect-src 'self' https: wss:",
  // The editor renders the app inside the Lovable preview iframe.
  "frame-ancestors 'self' https://lovable.dev https://*.lovable.dev https://*.lovable.app",
].join("; ");

const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "autoplay=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

/** Adds the baseline headers unless the handler already set them. */
export function withSecurityHeaders(request: Request, response: Response): Response {
  const headers = new Headers(response.headers);
  const set = (name: string, value: string) => {
    if (!headers.has(name)) headers.set(name, value);
  };

  set("X-Content-Type-Options", "nosniff");
  set("Referrer-Policy", "strict-origin-when-cross-origin");
  set("Permissions-Policy", PERMISSIONS_POLICY);
  set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  set("X-Permitted-Cross-Domain-Policies", "none");

  if (new URL(request.url).protocol === "https:") {
    set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  const contentType = headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
