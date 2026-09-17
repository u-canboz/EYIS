import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { listMedia, registerMedia } from "@/lib/commerce/media.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function MailAssetPicker({
  value,
  onChange,
  kind,
  label,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  kind: "logo" | "image" | "pdf";
  label: string;
}) {
  const { organizationId, shopId, can } = useActiveWorkspace();
  const list = useServerFn(listMedia),
    register = useServerFn(registerMedia);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const query = useQuery({
    queryKey: ["mail-assets", organizationId, shopId],
    enabled: !!organizationId && !!shopId,
    queryFn: () => list({ data: { organizationId, shopId, limit: 200 } }),
  });
  const allowed = kind === "pdf" ? ["application/pdf"] : ["image/png", "image/jpeg", "image/gif"];
  const assets = (query.data ?? []).filter((a) => allowed.includes(a.mime_type));
  async function upload(file: File) {
    if (!allowed.includes(file.type) || file.size > 5_000_000) {
      toast.error("Bitte einen unterstützten Dateityp bis 5 MB auswählen.");
      return;
    }
    setBusy(true);
    const storagePath = `${organizationId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    try {
      const { error } = await supabase.storage
        .from("media")
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const result = await register({
        data: {
          organizationId,
          shopId,
          storagePath,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        },
      });
      await query.refetch();
      onChange(kind === "pdf" ? [...value, result.id] : [result.id]);
      toast.success("Datei hochgeladen.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen.");
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }
  return (
    <div className="min-w-0 space-y-3">
      <label className="text-sm font-medium">{label}</label>
      {value.map((id) => {
        const a = assets.find((a) => a.id === id);
        return (
          <div
            key={id}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-border p-3"
          >
            {a?.url && kind !== "pdf" && (
              <img src={a.url} alt={a.filename} className="h-12 w-24 object-contain" />
            )}
            <span className="min-w-0 flex-1 truncate text-sm">
              {a?.filename ?? "Ausgewählte Datei"}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(value.filter((v) => v !== id))}
            >
              Entfernen
            </Button>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <select
          aria-label={`${label} aus Mediathek`}
          className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          value=""
          onChange={(e) =>
            e.target.value &&
            onChange(kind === "pdf" ? [...new Set([...value, e.target.value])] : [e.target.value])
          }
        >
          <option value="">Aus Mediathek wählen…</option>
          {assets
            .filter((a) => !value.includes(a.id))
            .map((a) => (
              <option key={a.id} value={a.id}>
                {a.filename}
              </option>
            ))}
        </select>
        <input
          ref={ref}
          type="file"
          className="hidden"
          accept={allowed.join(",")}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          variant="outline"
          disabled={busy || !can("media.upload") || (kind === "pdf" && value.length >= 5)}
          onClick={() => ref.current?.click()}
        >
          {busy ? "Lädt hoch…" : "Datei hochladen"}
        </Button>
      </div>
      {query.isError && (
        <p className="text-sm text-destructive">Die Mediathek konnte nicht geladen werden.</p>
      )}
    </div>
  );
}
