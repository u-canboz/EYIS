/**
 * Bildfeld mit echtem Upload in die Medienablage plus Adressfeld.
 * Der Upload läuft über denselben Weg wie die Produktbilder: Datei in den
 * öffentlichen Bucket `media`, danach Registrierung über `registerMedia`.
 */
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerMedia } from "@/lib/commerce/media.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  organizationId: string;
  shopId: string;
  canUpload: boolean;
};

const allowed = ["image/png", "image/jpeg", "image/webp", "image/avif"];

export function LogoUploadField({
  id,
  label,
  description,
  value,
  onChange,
  organizationId,
  shopId,
  canUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const runRegister = useServerFn(registerMedia);

  async function upload(file: File | undefined | null) {
    if (!file || !organizationId) return;
    if (!allowed.includes(file.type)) {
      toast.error("Erlaubt sind PNG, JPG, WEBP und AVIF. SVG bitte über die Adresse einbinden.");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Die Datei ist größer als 2 MB.");
      return;
    }
    setBusy(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const path = `${organizationId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage
        .from("media")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new Error(error.message);
      await runRegister({
        data: {
          organizationId,
          shopId: shopId || null,
          storagePath: path,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          altText: label,
        },
      });
      const { data: pub } = supabase.storage.from("media").getPublicUrl(path);
      onChange(pub.publicUrl);
      toast.success("Bild hochgeladen.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload nicht möglich.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (canUpload) void upload(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-lg border border-dashed p-4 transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border bg-muted/30"
        }`}
      >
        {value.trim() !== "" ? (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-center rounded-md border border-border bg-background p-3">
              <img
                src={value}
                alt={`Vorschau ${label} auf hellem Hintergrund`}
                className="h-10 w-auto max-w-[200px] object-contain"
                loading="lazy"
              />
            </div>
            <div className="flex items-center justify-center rounded-md border border-border bg-foreground p-3">
              <img
                src={value}
                alt={`Vorschau ${label} auf dunklem Hintergrund`}
                className="h-10 w-auto max-w-[200px] object-contain"
                loading="lazy"
              />
            </div>
          </div>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">{description}</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            onChange={(e) => void upload(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!canUpload || busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? "Lädt hoch…" : "Bild hochladen"}
          </Button>
          {value.trim() !== "" ? (
            <Button type="button" variant="ghost" onClick={() => onChange("")}>
              Entfernen
            </Button>
          ) : null}
          {!canUpload ? (
            <span className="text-xs text-muted-foreground">
              Zum Hochladen fehlt die Berechtigung „Medien hochladen“.
            </span>
          ) : null}
        </div>

        <div className="mt-3">
          <Input
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…/logo.svg"
          />
        </div>
      </div>
    </div>
  );
}
