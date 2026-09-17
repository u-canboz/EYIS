import type { Block } from "./communication.types";
export type NewsletterScope = { organizationId: string; shopId: string };
export type CampaignDraft = {
  id?: string;
  name: string;
  subject: string;
  preheader: string;
  blocks: Block[];
  kind: "broadcast" | "welcome";
  delayMinutes: number;
  scheduledAt: string | null;
};
export const NEWSLETTER_STATUS: Record<string, string> = {
  draft: "Entwurf",
  scheduled: "Geplant",
  active: "Aktiv",
  paused: "Pausiert",
  completed: "Versand vorbereitet",
  pending: "Unbestätigt",
  subscribed: "Angemeldet",
  unsubscribed: "Abgemeldet",
};
export const NEWSLETTER_STARTERS: { name: string; subject: string; blocks: Block[] }[] = [
  {
    name: "Neue Kollektion",
    subject: "Entdecke unsere Neuheiten",
    blocks: [
      { type: "heading", text: "Neu für dich ausgewählt." },
      {
        type: "text",
        text: "Hallo {{customer.first_name}},\nentdecke unsere neuesten Produkte – sorgfältig ausgewählt für dich.",
      },
      { type: "products", productIds: [] },
      { type: "button", label: "Alle Neuheiten entdecken", url: "{{shop.website_url}}" },
    ],
  },
  {
    name: "Persönliches Willkommen",
    subject: "Willkommen bei {{shop.name}}",
    blocks: [
      { type: "heading", text: "Schön, dass du da bist." },
      {
        type: "text",
        text: "Hallo {{customer.first_name}},\nvielen Dank für deine Anmeldung. Ab jetzt erfährst du zuerst von Neuheiten und ausgewählten Angeboten.",
      },
      { type: "button", label: "Shop entdecken", url: "{{shop.website_url}}" },
    ],
  },
  {
    name: "Shop-Geschichte",
    subject: "Ein Blick hinter die Kulissen",
    blocks: [
      { type: "heading", text: "Mit Sorgfalt gemacht." },
      { type: "text", text: "Heute möchten wir dir zeigen, was unsere Produkte besonders macht." },
      { type: "image" },
      { type: "text", text: "Erzähle hier deine Geschichte." },
    ],
  },
];
