/**
 * Deterministic block renderer: blocks + context + branding -> HTML + plain text.
 * Pure module, no IO, safe to unit test and to import from client code.
 */
import {
  ALLOWED_VARIABLES,
  DEFAULT_BRANDING,
  type Block,
  type CommunicationBranding,
  type CommunicationContext,
  type ContextLineItem,
} from "./communication.types";

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

function lookup(context: CommunicationContext, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === "object" ? (acc as Record<string, unknown>)[key] : undefined,
      context,
    );
}

/** Replaces {{path}} placeholders. Unknown or non-whitelisted paths render empty. */
export function interpolate(input: string, context: CommunicationContext): string {
  return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, path: string) => {
    if (!ALLOWED_VARIABLES.includes(path)) return "";
    const value = lookup(context, path);
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url) || url.startsWith("mailto:");
}

type Rendered = { html: string; text: string[] };

function table(rows: string, branding: CommunicationBranding): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;color:${branding.textColor}">${rows}</table>`;
}

function itemRows(items: ContextLineItem[], branding: CommunicationBranding): string {
  return items
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;border-bottom:1px solid #e4e4e7">${escapeHtml(i.name)}</td>` +
        `<td style="padding:6px 0;border-bottom:1px solid #e4e4e7;text-align:center;color:${branding.mutedTextColor}">${i.quantity}×</td>` +
        `<td style="padding:6px 0;border-bottom:1px solid #e4e4e7;text-align:right">${escapeHtml(i.line_total)}</td></tr>`,
    )
    .join("");
}

function itemLines(items: ContextLineItem[]): string[] {
  return items.map((i) => `- ${i.quantity}× ${i.name}: ${i.line_total}`);
}

function totalsRow(label: string, value: string, branding: CommunicationBranding, bold = false) {
  const weight = bold ? "600" : "400";
  return `<tr><td colspan="2" style="padding:4px 0;color:${branding.mutedTextColor};font-weight:${weight}">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;font-weight:${weight}">${escapeHtml(value)}</td></tr>`;
}

function renderBlock(
  block: Block,
  ctx: CommunicationContext,
  branding: CommunicationBranding,
): Rendered | null {
  const b = branding;
  switch (block.type) {
    case "logo": {
      if (!b.logoUrl || !isSafeUrl(b.logoUrl)) {
        return {
          html: `<div style="font-size:18px;font-weight:700;color:${b.primaryColor};padding-bottom:8px">${escapeHtml(ctx.shop.name)}</div>`,
          text: [ctx.shop.name],
        };
      }
      return {
        html: `<div style="padding-bottom:8px"><img src="${escapeHtml(b.logoUrl)}" alt="${escapeHtml(ctx.shop.name)}" height="40" style="max-height:40px;border:0"/></div>`,
        text: [ctx.shop.name],
      };
    }
    case "heading": {
      const value = interpolate(block.text ?? "", ctx).trim();
      if (!value) return null;
      return {
        html: `<h1 style="margin:16px 0 8px;font-size:20px;line-height:1.3;color:${b.textColor}">${escapeHtml(value)}</h1>`,
        text: [value, "".padEnd(Math.min(value.length, 40), "=")],
      };
    }
    case "text": {
      const value = interpolate(block.text ?? "", ctx).trim();
      if (!value) return null;
      return {
        html: `<p style="margin:0 0 12px;line-height:1.6;color:${b.textColor}">${escapeHtml(value).replace(/\n/g, "<br/>")}</p>`,
        text: [value],
      };
    }
    case "button": {
      const url = interpolate(block.url ?? "", ctx).trim();
      const label = interpolate(block.label ?? "", ctx).trim() || "Öffnen";
      if (!url || !isSafeUrl(url)) return null;
      const solid = b.buttonStyle !== "outline";
      const style = solid
        ? `background:${b.primaryColor};color:#ffffff;border:1px solid ${b.primaryColor}`
        : `background:transparent;color:${b.primaryColor};border:1px solid ${b.primaryColor}`;
      return {
        html: `<div style="margin:16px 0"><a href="${escapeHtml(url)}" style="${style};border-radius:${b.borderRadius}px;display:inline-block;padding:10px 18px;font-weight:600;text-decoration:none">${escapeHtml(label)}</a></div>`,
        text: [`${label}: ${url}`],
      };
    }
    case "divider":
      return {
        html: `<hr style="border:none;border-top:1px solid #e4e4e7;margin:16px 0"/>`,
        text: [],
      };
    case "order_summary": {
      const o = ctx.order;
      if (!o) return null;
      const rows =
        itemRows(o.items, b) +
        totalsRow("Zwischensumme", o.subtotal, b) +
        (o.discount ? totalsRow("Rabatt", o.discount, b) : "") +
        totalsRow("Versand", o.shipping, b) +
        totalsRow("Steuern", o.tax, b) +
        totalsRow("Gesamt", o.total, b, true);
      return {
        html: `<div style="margin:12px 0"><div style="font-weight:600;margin-bottom:6px">Bestellung ${escapeHtml(o.number)}</div>${table(rows, b)}</div>`,
        text: [
          `Bestellung ${o.number} vom ${o.date}`,
          ...itemLines(o.items),
          `Zwischensumme: ${o.subtotal}`,
          `Versand: ${o.shipping}`,
          `Steuern: ${o.tax}`,
          `Gesamt: ${o.total}`,
        ],
      };
    }
    case "payment_summary": {
      const p = ctx.payment;
      if (!p) return null;
      const rows =
        totalsRow("Zahlungsart", p.method, b) +
        totalsRow("Status", p.status, b) +
        totalsRow("Betrag", p.amount, b, true);
      return {
        html: `<div style="margin:12px 0">${table(rows, b)}</div>`,
        text: [`Zahlungsart: ${p.method}`, `Status: ${p.status}`, `Betrag: ${p.amount}`],
      };
    }
    case "refund_summary": {
      const r = ctx.refund;
      if (!r) return null;
      const rows =
        totalsRow("Erstattungsbetrag", r.amount, b, true) +
        (r.reason ? totalsRow("Grund", r.reason, b) : "");
      return {
        html: `<div style="margin:12px 0">${table(rows, b)}</div>`,
        text: [`Erstattungsbetrag: ${r.amount}`],
      };
    }
    case "shipment_summary": {
      const s = ctx.shipment;
      if (!s) return null;
      const rows =
        itemRows(s.items, b) +
        totalsRow("Versanddienstleister", s.carrier, b) +
        (s.tracking_number ? totalsRow("Sendungsnummer", s.tracking_number, b) : "");
      return {
        html: `<div style="margin:12px 0">${table(rows, b)}</div>`,
        text: [
          ...itemLines(s.items),
          `Versanddienstleister: ${s.carrier}`,
          s.tracking_number ? `Sendungsnummer: ${s.tracking_number}` : "",
        ].filter(Boolean),
      };
    }
    case "tracking": {
      const s = ctx.shipment;
      if (!s || !s.tracking_number) return null;
      const link =
        s.tracking_url && isSafeUrl(s.tracking_url)
          ? `<div style="margin-top:6px"><a href="${escapeHtml(s.tracking_url)}" style="color:${b.primaryColor}">Sendung verfolgen</a></div>`
          : "";
      return {
        html: `<div style="margin:12px 0;padding:12px;border:1px solid #e4e4e7;border-radius:${b.borderRadius}px"><div style="font-weight:600">${escapeHtml(s.carrier)}</div><div style="color:${b.mutedTextColor}">Sendungsnummer ${escapeHtml(s.tracking_number)}</div>${link}</div>`,
        text: [
          `${s.carrier} – Sendungsnummer ${s.tracking_number}`,
          s.tracking_url ? `Sendung verfolgen: ${s.tracking_url}` : "",
        ].filter(Boolean),
      };
    }
    case "document": {
      const doc = ctx.invoice ?? ctx.credit_note;
      if (!doc) return null;
      const rows = totalsRow("Nummer", doc.number, b) + totalsRow("Betrag", doc.total, b, true);
      return {
        html: `<div style="margin:12px 0">${table(rows, b)}<p style="color:${b.mutedTextColor};font-size:12px;margin-top:8px">Der Download-Link ist aus Sicherheitsgründen zeitlich begrenzt gültig.</p></div>`,
        text: [
          `Nummer: ${doc.number}`,
          `Betrag: ${doc.total}`,
          "Der Download-Link ist zeitlich begrenzt gültig.",
        ],
      };
    }
    case "return_summary": {
      const r = ctx.return;
      if (!r) return null;
      const rows = itemRows(r.items, b) + totalsRow("Status", r.status, b);
      const hint = r.instructions
        ? `<p style="color:${b.mutedTextColor};margin-top:8px">${escapeHtml(r.instructions)}</p>`
        : "";
      return {
        html: `<div style="margin:12px 0"><div style="font-weight:600;margin-bottom:6px">Retoure ${escapeHtml(r.number)}</div>${table(rows, b)}${hint}</div>`,
        text: [
          `Retoure ${r.number}`,
          ...itemLines(r.items),
          `Status: ${r.status}`,
          r.instructions,
        ].filter(Boolean) as string[],
      };
    }
    case "address": {
      const lines = ctx.order?.shipping_address ?? [];
      if (!lines.length) return null;
      return {
        html: `<div style="margin:12px 0;color:${b.textColor}"><div style="font-weight:600;margin-bottom:4px">Lieferadresse</div>${lines
          .map((l) => `<div>${escapeHtml(l)}</div>`)
          .join("")}</div>`,
        text: ["Lieferadresse:", ...lines],
      };
    }
    case "footer": {
      const footer = interpolate(b.footerText || "", ctx).trim();
      const contact = [
        b.supportEmail ?? ctx.shop.support_email,
        b.websiteUrl ?? ctx.shop.website_url,
      ].filter(Boolean);
      const social = b.socialLinks
        .filter((s) => isSafeUrl(s.url))
        .map(
          (s) =>
            `<a href="${escapeHtml(s.url)}" style="color:${b.mutedTextColor};margin-right:8px">${escapeHtml(s.label)}</a>`,
        )
        .join("");
      return {
        html: `<div style="margin-top:24px;padding-top:12px;border-top:1px solid #e4e4e7;color:${b.mutedTextColor};font-size:12px;line-height:1.5">${
          footer ? `<div>${escapeHtml(footer)}</div>` : ""
        }${contact.length ? `<div>${escapeHtml(contact.join(" · "))}</div>` : ""}${
          social ? `<div style="margin-top:6px">${social}</div>` : ""
        }</div>`,
        text: [footer, contact.join(" · ")].filter(Boolean),
      };
    }
    default:
      return null;
  }
}

export type RenderResult = { subject: string; html: string; text: string };

export function renderEmail(input: {
  subject: string;
  preheader?: string | null;
  blocks: Block[];
  context: CommunicationContext;
  branding?: Partial<CommunicationBranding> | null;
}): RenderResult {
  const branding: CommunicationBranding = { ...DEFAULT_BRANDING, ...(input.branding ?? {}) };
  const rendered = input.blocks
    .map((block) => renderBlock(block, input.context, branding))
    .filter((r): r is Rendered => r !== null);

  const subject = interpolate(input.subject, input.context).trim();
  const preheader = interpolate(input.preheader ?? "", input.context).trim();

  const body = rendered.map((r) => r.html).join("\n");
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${escapeHtml(subject)}</title></head><body style="margin:0;padding:0;background:${branding.backgroundColor};font-family:${branding.fontFamily}">${
    preheader
      ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>`
      : ""
  }<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${branding.backgroundColor};padding:24px 12px"><tr><td align="center"><table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${branding.contentBackgroundColor};border-radius:${branding.borderRadius}px;padding:24px;text-align:left">${
    body ? `<tr><td>${body}</td></tr>` : ""
  }</table></td></tr></table></body></html>`;

  const text = rendered
    .flatMap((r) => r.text)
    .filter((line) => line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return { subject, html, text };
}
