import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listProducts } from "@/lib/commerce/products.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import {
  BLOCK_LABELS,
  EDITABLE_BLOCKS,
  type Block,
  type BlockType,
} from "@/lib/commerce/communications/communication.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MailAssetPicker } from "./MailAssetPicker";

function ProductPicker({ ids, onChange }: { ids: string[]; onChange: (ids: string[]) => void }) {
  const { organizationId, shopId } = useActiveWorkspace();
  const list = useServerFn(listProducts);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["newsletter-products", organizationId, shopId, search],
    enabled: !!shopId,
    queryFn: () =>
      list({ data: { organizationId, shopId, status: "active", search, pageSize: 50 } }),
  });
  return (
    <div className="space-y-2">
      <Input
        aria-label="Produkte suchen"
        placeholder="Produkte suchen…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        {ids.length} von 12 Produkten ausgewählt. Preise werden beim Versand vom Server geladen.
      </p>
      <div className="max-h-60 space-y-1 overflow-y-auto">
        {query.data?.items.map((p) => (
          <label
            key={p.id}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted"
          >
            <input
              type="checkbox"
              checked={ids.includes(p.id)}
              disabled={!ids.includes(p.id) && ids.length >= 12}
              onChange={(e) =>
                onChange(e.target.checked ? [...ids, p.id] : ids.filter((v) => v !== p.id))
              }
            />
            {p.cover_url && (
              <img src={p.cover_url} alt="" className="size-9 rounded object-cover" />
            )}
            <span className="min-w-0 text-sm">{p.name}</span>
          </label>
        ))}
      </div>
      {query.isError && (
        <p className="text-sm text-destructive">Produkte konnten nicht geladen werden.</p>
      )}
    </div>
  );
}
export function MailBlockEditor({
  blocks,
  onChange,
  disabled = false,
  newsletter = false,
}: {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  disabled?: boolean;
  newsletter?: boolean;
}) {
  const patch = (i: number, p: Partial<Block>) =>
    onChange(blocks.map((b, j) => (i === j ? { ...b, ...p } : b)));
  function move(i: number, delta: number) {
    const target = i + delta;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[target]] = [next[target]!, next[i]!];
    onChange(next);
  }
  const choices = EDITABLE_BLOCKS.filter(
    (b) =>
      !["logo", "footer"].includes(b) &&
      (!newsletter ||
        [
          "heading",
          "text",
          "button",
          "divider",
          "image",
          "products",
          "legal",
          "attachment",
        ].includes(b)),
  );
  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      <legend className="mb-3 text-sm font-medium">E-Mail gestalten</legend>
      <p className="text-xs text-muted-foreground">
        Logo, Farben und Fußzeile kommen automatisch aus dem Branding Studio.
      </p>
      {blocks
        .filter((b) => !["logo", "footer"].includes(b.type))
        .map((block) => {
          const index = blocks.indexOf(block);
          return (
            <div
              key={index}
              className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <strong className="text-sm">{BLOCK_LABELS[block.type]}</strong>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${BLOCK_LABELS[block.type]} nach oben`}
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`${BLOCK_LABELS[block.type]} nach unten`}
                    disabled={disabled || index === blocks.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    ↓
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onChange(blocks.filter((_, i) => i !== index))}
                  >
                    Entfernen
                  </Button>
                </div>
              </div>
              {["heading", "text"].includes(block.type) && (
                <Textarea
                  aria-label={`${BLOCK_LABELS[block.type]} ${index + 1}`}
                  rows={block.type === "text" ? 4 : 2}
                  value={block.text ?? ""}
                  onChange={(e) => patch(index, { text: e.target.value })}
                />
              )}
              {block.type === "button" && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    aria-label="Button-Text"
                    placeholder="Button-Text"
                    value={block.label ?? ""}
                    onChange={(e) => patch(index, { label: e.target.value })}
                  />
                  <Input
                    aria-label="Button-Link"
                    placeholder="https://… oder {{shop.website_url}}"
                    value={block.url ?? ""}
                    onChange={(e) => patch(index, { url: e.target.value })}
                  />
                </div>
              )}
              {["image", "attachment"].includes(block.type) && (
                <MailAssetPicker
                  label={block.type === "image" ? "Bild auswählen" : "PDF auswählen"}
                  kind={block.type === "image" ? "image" : "pdf"}
                  value={block.mediaId ? [block.mediaId] : []}
                  onChange={(ids) => patch(index, { mediaId: ids.at(-1) ?? "" })}
                />
              )}
              {block.type === "image" && (
                <Input
                  aria-label="Bildbeschreibung"
                  placeholder="Bildbeschreibung für Barrierefreiheit"
                  value={block.text ?? ""}
                  onChange={(e) => patch(index, { text: e.target.value })}
                />
              )}
              {block.type === "products" && (
                <ProductPicker
                  ids={block.productIds ?? []}
                  onChange={(productIds) => patch(index, { productIds })}
                />
              )}
              {block.type === "legal" && (
                <p className="text-sm text-muted-foreground">
                  Verwendet den Rechtstext aus dem Branding Studio.
                </p>
              )}
            </div>
          );
        })}
      <select
        aria-label="Baustein hinzufügen"
        value=""
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm"
        onChange={(e) =>
          e.target.value && onChange([...blocks, { type: e.target.value as BlockType }])
        }
      >
        <option value="">+ Baustein hinzufügen</option>
        {choices.map((type) => (
          <option key={type} value={type}>
            {BLOCK_LABELS[type]}
          </option>
        ))}
      </select>
    </fieldset>
  );
}
