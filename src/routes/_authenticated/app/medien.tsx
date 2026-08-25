import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listMedia, registerMedia, updateMedia, deleteMedia } from "@/lib/commerce/media.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/medien")({
  head: () => ({
    meta: [
      { title: "Medienbibliothek – Commerce OS" },
      {
        name: "description",
        content: "Bilder und Dateien für den Katalog hochladen, benennen und verwalten.",
      },
      { property: "og:title", content: "Medienbibliothek – Commerce OS" },
      { property: "og:description", content: "Zentrale Medienverwaltung für alle Produkte." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);

  const fetchMedia = useServerFn(listMedia);
  const runRegister = useServerFn(registerMedia);
  const runUpdate = useServerFn(updateMedia);
  const runDelete = useServerFn(deleteMedia);

  const mediaQuery = useQuery({
    queryKey: ["media", organizationId, search],
    enabled: Boolean(organizationId),
    queryFn: () => fetchMedia({ data: { organizationId, search } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["media"] });

  const updateMutation = useMutation({
    mutationFn: (input: { mediaId: string; altText?: string; title?: string }) =>
      runUpdate({ data: { organizationId, ...input } }),
    onSuccess: () => {
      toast.success("Gespeichert.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (mediaId: string) => runDelete({ data: { organizationId, mediaId } }),
    onSuccess: () => {
      toast.success("Datei gelöscht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleFiles(files: FileList | null) {
    if (!files?.length || !organizationId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const path = `${organizationId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await supabase.storage.from("media").upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw new Error(error.message);
        await runRegister({
          data: {
            organizationId,
            shopId,
            storagePath: path,
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          },
        });
      }
      toast.success("Upload abgeschlossen.");
      invalidate();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const canUpload = can("media.upload");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Medien</h1>
          <p className="text-sm text-muted-foreground">
            Zentrale Bibliothek für alle Produktbilder deiner Organisation.
          </p>
        </div>
        {canUpload && (
          <div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <Button disabled={uploading} onClick={() => inputRef.current?.click()}>
              {uploading ? "Lädt hoch…" : "Dateien hochladen"}
            </Button>
          </div>
        )}
      </header>

      <Input
        placeholder="Dateien suchen"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {mediaQuery.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (mediaQuery.data ?? []).length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="font-medium">Noch keine Dateien</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Lade Bilder hoch, um sie anschließend Produkten zuzuordnen.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(mediaQuery.data ?? []).map((asset) => (
            <div key={asset.id} className="rounded-lg border bg-card p-3">
              {asset.url ? (
                <img
                  src={asset.url}
                  alt={asset.alt_text ?? asset.filename}
                  className="aspect-video w-full rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-video w-full rounded bg-muted" />
              )}
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{asset.filename}</p>
                <Badge variant="secondary">{asset.usage_count}× verwendet</Badge>
              </div>
              <div className="mt-3">
                <Label className="text-xs">Alternativtext</Label>
                <Input
                  className="mt-1"
                  defaultValue={asset.alt_text ?? ""}
                  disabled={!canUpload}
                  onBlur={(e) =>
                    e.target.value !== (asset.alt_text ?? "") &&
                    updateMutation.mutate({ mediaId: asset.id, altText: e.target.value })
                  }
                />
              </div>
              {can("media.manage") && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2"
                  disabled={deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(asset.id)}
                >
                  Löschen
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
