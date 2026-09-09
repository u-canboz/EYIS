/**
import { shop } from "@/content/shop";
 * der Shop — Marken-E-Mail-Layout.
 *
 * E-Mail-sicheres HTML (Tabellen-Layout, Inline-Styles), abgestimmt auf die
 * Storefront: Sandfläche, dunkles Oliv, Messing-Akzente, Cormorant Garamond
 * für Überschriften (mit Georgia-Fallback), Manrope/Helvetica für Fließtext.
 *
 * Diese Vorlagen werden nach der Domain-Einrichtung an den Auth-Versand
 * angebunden. SITE_NAME und FROM_DOMAIN werden dann zentral gesetzt.
 */

export const SITE_NAME = `${shop.name}`;
export const FROM_DOMAIN = "beispiel.de"; // Vor dem Livegang auf die eigene Absenderdomain setzen
export const SUPPORT_EMAIL = `salam@${FROM_DOMAIN}`;

const colors = {
  sand: "#f6f1e7",
  card: "#fffdf8",
  olive: "#3a4034",
  oliveSoft: "#5c6355",
  brass: "#a4814f",
  line: "#e6ddc9",
  white: "#ffffff",
} as const;

const fonts = {
  heading: "'Cormorant Garamond', Georgia, 'Times New Roman', serif",
  body: "Manrope, 'Helvetica Neue', Arial, sans-serif",
} as const;

export interface EmailAction {
  label: string;
  url: string;
}

export interface EmailContent {
  eyebrow?: string;
  title: string;
  greeting?: string;
  paragraphs: string[];
  action?: EmailAction;
  /** Groß hervorgehobener Wert, z. B. ein Sicherheitscode. */
  highlight?: string;
  /** Kleingedrucktes unter dem Button, z. B. Gültigkeit des Links. */
  note?: string;
  /** Rohlink zur manuellen Kopie, falls der Button nicht funktioniert. */
  fallbackUrl?: string;
}

function buttonHtml(action: EmailAction): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 32px auto 8px;">
      <tr>
        <td align="center" bgcolor="${colors.olive}" style="border-radius: 3px;">
          <a href="${action.url}" target="_blank"
             style="display: inline-block; padding: 15px 42px; font-family: ${fonts.body}; font-size: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: ${colors.white}; text-decoration: none; border-radius: 3px;">
            ${action.label}
          </a>
        </td>
      </tr>
    </table>`;
}

export function renderEmail(content: EmailContent): string {
  const paragraphs = content.paragraphs
    .map(
      (p) => `
      <p style="margin: 0 0 18px; font-family: ${fonts.body}; font-size: 16px; line-height: 1.7; color: ${colors.oliveSoft};">
        ${p}
      </p>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="de" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>${content.title} — ${SITE_NAME}</title>
  <!--[if mso]><style>table{font-family: Arial, sans-serif !important;}</style><![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.sand}; -webkit-font-smoothing: antialiased;">
  <div style="display: none; max-height: 0; overflow: hidden;">${content.title} — ${SITE_NAME}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${colors.sand}" style="background-color: ${colors.sand};">
    <tr>
      <td align="center" style="padding: 40px 16px 48px;">

        <!-- Kopf -->
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; width: 100%;">
          <tr>
            <td align="center" style="padding: 0 0 28px;">
              <span style="font-family: ${fonts.heading}; font-size: 30px; letter-spacing: 0.04em; color: ${colors.olive};">${SITE_NAME}</span>
              <div style="width: 44px; height: 1px; background-color: ${colors.brass}; margin: 12px auto 0;"></div>
            </td>
          </tr>

          <!-- Karte -->
          <tr>
            <td bgcolor="${colors.card}" style="background-color: ${colors.card}; border: 1px solid ${colors.line}; border-radius: 4px; padding: 48px 44px;">
              ${content.eyebrow ? `
              <p style="margin: 0 0 10px; font-family: ${fonts.body}; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: ${colors.brass}; text-align: center;">
                ${content.eyebrow}
              </p>` : ""}
              <h1 style="margin: 0 0 24px; font-family: ${fonts.heading}; font-size: 32px; font-weight: 500; line-height: 1.25; color: ${colors.olive}; text-align: center;">
                ${content.title}
              </h1>
              ${content.greeting ? `
              <p style="margin: 0 0 18px; font-family: ${fonts.body}; font-size: 16px; line-height: 1.7; color: ${colors.olive};">
                ${content.greeting}
              </p>` : ""}
              ${paragraphs}
              ${content.highlight ? `
              <p style="margin: 8px 0 24px; font-family: ${fonts.heading}; font-size: 34px; letter-spacing: 0.35em; text-align: center; color: ${colors.olive};">
                ${content.highlight}
              </p>` : ""}
              ${content.action ? buttonHtml(content.action) : ""}
              ${content.note ? `
              <p style="margin: 20px 0 0; font-family: ${fonts.body}; font-size: 13px; line-height: 1.6; color: ${colors.oliveSoft}; text-align: center;">
                ${content.note}
              </p>` : ""}
              ${content.fallbackUrl ? `
              <p style="margin: 24px 0 0; padding-top: 20px; border-top: 1px solid ${colors.line}; font-family: ${fonts.body}; font-size: 12px; line-height: 1.6; color: ${colors.oliveSoft}; word-break: break-all;">
                Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:<br />
                <a href="${content.fallbackUrl}" style="color: ${colors.brass}; text-decoration: underline;">${content.fallbackUrl}</a>
              </p>` : ""}
            </td>
          </tr>

          <!-- Fuß -->
          <tr>
            <td align="center" style="padding: 32px 24px 0;">
              <p style="margin: 0 0 8px; font-family: ${fonts.body}; font-size: 12px; line-height: 1.6; color: ${colors.oliveSoft};">
                ${SITE_NAME} · Natürliche Produkte in Prophetischer Tradition
              </p>
              <p style="margin: 0; font-family: ${fonts.body}; font-size: 12px; line-height: 1.6; color: ${colors.oliveSoft};">
                Fragen? Schreib uns an <a href="mailto:${SUPPORT_EMAIL}" style="color: ${colors.brass}; text-decoration: underline;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}
