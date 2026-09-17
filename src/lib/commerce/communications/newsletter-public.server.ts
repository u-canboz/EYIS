import { escapeHtml } from "./renderer";
export function newsletterPage(
  kind: "confirm" | "unsubscribe",
  token: string,
  message?: string,
  success = false,
  status = 200,
) {
  const title = kind === "confirm" ? "Newsletter-Anmeldung bestätigen" : "Newsletter abmelden";
  const label = kind === "confirm" ? "Anmeldung bestätigen" : "Jetzt abmelden";
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="font-family:Arial,sans-serif;background:#f5f5f5;color:#20252b;margin:0;padding:24px"><main style="max-width:480px;margin:12vh auto;background:white;padding:32px;border-radius:16px"><h1 style="font-size:26px">${success ? "Vielen Dank." : title}</h1><p style="line-height:1.6">${escapeHtml(message || (kind === "confirm" ? "Bestätige deine Anmeldung, um Neuigkeiten und Angebote per E-Mail zu erhalten." : "Du kannst den Newsletter hier jederzeit abbestellen."))}</p>${!success && !message ? `<form method="post"><input type="hidden" name="token" value="${escapeHtml(token)}"><button style="border:0;border-radius:8px;padding:14px 20px;background:#20252b;color:white;font-size:16px;cursor:pointer">${label}</button></form>` : ""}</main></body></html>`,
    {
      status,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
        "content-security-policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
