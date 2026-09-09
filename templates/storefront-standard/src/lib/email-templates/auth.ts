/**
 * der Shop — E-Mail-Vorlagen für die Konto-Kommunikation.
 *
 * Alle sechs Auth-Anlässe im einheitlichen Markendesign. Texte ruhig,
 * persönlich und ohne aufdringliche Werbesprache. Wird nach der
 * Domain-Einrichtung an den Versand angebunden.
 */

import { renderEmail } from "./layout";
import { shop } from "@/content/shop";

export interface AuthEmailInput {
  /** Bestätigungs- bzw. Aktionslink aus dem Kontosystem. */
  actionUrl: string;
  /** Optionaler Vorname des Empfängers. */
  name?: string | null;
  /** Neue E-Mail-Adresse (nur bei Adressänderung). */
  newEmail?: string | null;
  /** Einmalcode (nur bei Reauthentifizierung). */
  otp?: string | null;
}

function greeting(name?: string | null): string {
  return name ? `Assalamu alaikum ${name},` : "Assalamu alaikum,";
}

export function signupConfirmationEmail(input: AuthEmailInput): string {
  return renderEmail({
    eyebrow: "Willkommen",
    title: "Schön, dass du da bist",
    greeting: greeting(input.name),
    paragraphs: [
      `dein Konto im ${shop.name} ist fast bereit. Bestätige bitte einmal deine E-Mail-Adresse, damit wir deine Bestellungen und dein Konto sicher zuordnen können.`,
    ],
    action: { label: "E-Mail-Adresse bestätigen", url: input.actionUrl },
    note: "Der Link ist 24 Stunden gültig.",
    fallbackUrl: input.actionUrl,
  });
}

export function recoveryEmail(input: AuthEmailInput): string {
  return renderEmail({
    eyebrow: "Passwort zurücksetzen",
    title: "Ein neues Passwort für dein Konto",
    greeting: greeting(input.name),
    paragraphs: [
      "du hast angefragt, dein Passwort zurückzusetzen. Über den folgenden Button vergibst du ein neues Passwort.",
      "Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail einfach ignorieren — dein bisheriges Passwort bleibt gültig.",
    ],
    action: { label: "Passwort zurücksetzen", url: input.actionUrl },
    note: "Der Link ist 1 Stunde gültig.",
    fallbackUrl: input.actionUrl,
  });
}

export function magicLinkEmail(input: AuthEmailInput): string {
  return renderEmail({
    eyebrow: "Anmeldung",
    title: "Dein persönlicher Anmeldelink",
    greeting: greeting(input.name),
    paragraphs: [
      "mit einem Klick bist du angemeldet — ganz ohne Passwort.",
    ],
    action: { label: "Jetzt anmelden", url: input.actionUrl },
    note: "Der Link ist 1 Stunde gültig und nur einmal verwendbar.",
    fallbackUrl: input.actionUrl,
  });
}

export function inviteEmail(input: AuthEmailInput): string {
  return renderEmail({
    eyebrow: "Einladung",
    title: "Du wurdest eingeladen",
    greeting: greeting(input.name),
    paragraphs: [
      `du wurdest eingeladen, ein Konto im ${shop.name} zu erstellen. Nimm die Einladung an und richte dein Konto in wenigen Schritten ein.`,
    ],
    action: { label: "Einladung annehmen", url: input.actionUrl },
    note: "Der Link ist 24 Stunden gültig.",
    fallbackUrl: input.actionUrl,
  });
}

export function emailChangeEmail(input: AuthEmailInput): string {
  return renderEmail({
    eyebrow: "Kontosicherheit",
    title: "Bestätige deine neue E-Mail-Adresse",
    greeting: greeting(input.name),
    paragraphs: [
      `für dein Konto wurde eine Änderung der E-Mail-Adresse${input.newEmail ? ` auf <strong>${input.newEmail}</strong>` : ""} angefragt. Bestätige die neue Adresse, damit die Änderung wirksam wird.`,
      "Falls du diese Änderung nicht veranlasst hast, melde dich bitte umgehend bei uns.",
    ],
    action: { label: "Neue Adresse bestätigen", url: input.actionUrl },
    note: "Der Link ist 24 Stunden gültig.",
    fallbackUrl: input.actionUrl,
  });
}

export function reauthenticationEmail(input: AuthEmailInput): string {
  return renderEmail({
    eyebrow: "Bestätigungscode",
    title: "Dein Sicherheitscode",
    greeting: greeting(input.name),
    paragraphs: [
      "für diesen Schritt benötigen wir eine kurze zusätzliche Bestätigung. Dein Code lautet:",
    ],
    highlight: input.otp ?? "",
    note: "Der Code ist 10 Minuten gültig. Gib ihn niemals an Dritte weiter.",
  });
}

export const authEmails = {
  signup: signupConfirmationEmail,
  recovery: recoveryEmail,
  magiclink: magicLinkEmail,
  invite: inviteEmail,
  email_change: emailChangeEmail,
  reauthentication: reauthenticationEmail,
} as const;
