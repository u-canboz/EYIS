import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  forkTemplateFn,
  getTemplateFn,
  previewTemplateFn,
  publishTemplateVersionFn,
  saveTemplateDraftFn,
  sendTestCommunicationFn,
  setTemplateStatusFn,
} from "@/lib/commerce/communications/communication.functions";
import {
  BLOCK_LABELS,
  EDITABLE_BLOCKS,
  VARIABLE_CATALOGUE,
  type Block,
  type BlockType,
} from "@/lib/commerce/communications/communication.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StickyActionBar } from "@/components/shell/PageHeader";
import { DetailLayout, Panel } from "@/components/shell/DetailLayout";

export const Route = createFileRoute("/_authenticated/app/kommunikation/vorlagen/$templateId")({
  head: () => ({
    meta: [
      { title: "Vorlage bearbeiten – Commerce OS" },
      {
        name: "description",
        content: "E-Mail-Vorlage bearbeiten, Vorschau prüfen, Testmail senden und veröffentlichen.",
      },
      { property: "og:title", content: "Vorlage bearbeiten – Commerce OS" },
      { property: "og:description", content: "Blockbasierter Editor für transaktionale E-Mails." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplateEditor,
});

function TemplateEditor() {
  const { templateId } = Route.useParams();
  const { organizationId, shopId } = useActiveWorkspace();
  const router = useRouter();

  const fetchTemplate = useServerFn(getTemplateFn);
  const fork = useServerFn(forkTemplateFn);
  const saveDraft = useServerFn(saveTemplateDraftFn);
  const publish = useServerFn(publishTemplateVersionFn);
  const setStatus = useServerFn(setTemplateStatusFn);
  const preview = useServerFn(previewTemplateFn);
  const sendTest = useServerFn(sendTestCommunicationFn);

  const template = useQuery({
    queryKey: ["communication-template", organizationId, templateId],
    enabled: !!organizationId,
    queryFn: () => fetchTemplate({ data: { organizationId, templateId } }),
  });

  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [dirty, setDirty] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [busy, setBusy] = useState(false);

  const current = useMemo(() => {
    const versions = template.data?.versions ?? [];
    return versions.find((v) => !v.publishedAt) ?? versions[0] ?? null;
  }, [template.data]);

  useEffect(() => {
    if (!current) return;
    setSubject(current.subject);
    setPreheader(current.preheader ?? "");
    setBlocks(current.blocks);
    setDirty(false);
  }, [current]);

  const previewQuery = useQuery({
    queryKey: ["communication-preview", organizationId, shopId, templateId, subject, blocks],
    enabled: !!organizationId && !!shopId && blocks.length > 0,
    queryFn: () => preview({ data: { organizationId, shopId, subject, preheader, blocks } }),
  });

  const isSystem = !template.data?.organizationId;

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(label);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  function patchBlock(index: number, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
    setDirty(true);
  }
  function moveBlock(index: number, direction: -1 | 1) {
    setBlocks((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setDirty(true);
  }

  function saveDraftNow() {
    return run("Entwurf gespeichert.", async () => {
      await saveDraft({
        data: {
          organizationId,
          templateId,
          locale: current?.locale ?? "de-DE",
          subject,
          preheader: preheader || null,
          blocks,
        },
      });
      setDirty(false);
      await template.refetch();
    });
  }

  if (template.isLoading || !template.data) {
    return (
      <div className="min-w-0 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 pb-20 sm:pb-0">
      <PageHeader
        eyebrow={
          <Link
            to="/app/kommunikation/vorlagen"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Alle Vorlagen
          </Link>
        }
        title={template.data.name}
        description={template.data.key}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={isSystem ? "outline" : "secondary"}>
              {isSystem ? "Systemvorlage" : "Eigene Fassung"}
            </Badge>
            {!isSystem && (
              <Button
                variant="outline"
                size="sm"
                className="h-11"
                disabled={busy}
                onClick={() =>
                  run("Status aktualisiert.", async () => {
                    await setStatus({
                      data: {
                        organizationId,
                        templateId,
                        status: template.data!.status === "active" ? "disabled" : "active",
                      },
                    });
                    await template.refetch();
                  })
                }
              >
                {template.data.status === "active" ? "Deaktivieren" : "Aktivieren"}
              </Button>
            )}
            {!isSystem && (
              <Button
                size="sm"
                className="hidden h-11 sm:inline-flex"
                disabled={busy || !dirty}
                onClick={saveDraftNow}
              >
                Entwurf speichern
              </Button>
            )}
          </div>
        }
      />

      {isSystem && (
        <Panel title="Systemvorlage" className="border-dashed">
          <p className="text-sm text-pretty text-muted-foreground">
            Systemvorlagen werden nie verändert. Erstelle eine eigene Fassung für diesen Shop, um
            Betreff, Texte und Blöcke anzupassen.
          </p>
          <Button
            className="mt-3 h-11"
            size="sm"
            disabled={busy}
            onClick={() =>
              run("Eigene Fassung erstellt.", async () => {
                const result = await fork({ data: { organizationId, shopId, templateId } });
                router.navigate({
                  to: "/app/kommunikation/vorlagen/$templateId",
                  params: { templateId: result.templateId },
                });
              })
            }
          >
            Eigene Fassung erstellen
          </Button>
        </Panel>
      )}

      <DetailLayout
        main={
          <>
            <Panel title="Inhalt" bodyClassName="space-y-4">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="subject">Betreff</Label>
                <Input
                  id="subject"
                  className="h-11"
                  value={subject}
                  disabled={isSystem}
                  onChange={(e) => {
                    setSubject(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="preheader">Preheader</Label>
                <Input
                  id="preheader"
                  className="h-11"
                  value={preheader}
                  disabled={isSystem}
                  onChange={(e) => {
                    setPreheader(e.target.value);
                    setDirty(true);
                  }}
                />
              </div>

              <div className="min-w-0 space-y-3">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                  <p className="truncate text-sm font-medium">Blöcke</p>
                  {!isSystem && (
                    <Select
                      onValueChange={(value) => {
                        setBlocks((prev) => [...prev, { type: value as BlockType }]);
                        setDirty(true);
                      }}
                    >
                      <SelectTrigger aria-label="Block hinzufügen" className="h-11 w-48 shrink-0 text-xs">
                        <SelectValue placeholder="Block hinzufügen" />
                      </SelectTrigger>
                      <SelectContent>
                        {EDITABLE_BLOCKS.map((b) => (
                          <SelectItem key={b} value={b}>
                            {BLOCK_LABELS[b]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {blocks.map((block, index) => (
                  <div key={`${block.type}-${index}`} className="min-w-0 rounded-lg border border-border p-3">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                      <p className="truncate text-sm font-medium">
                        {BLOCK_LABELS[block.type] ?? block.type}
                      </p>
                      {!isSystem && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-9"
                            onClick={() => moveBlock(index, -1)}
                          >
                            ↑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="size-9"
                            onClick={() => moveBlock(index, 1)}
                          >
                            ↓
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setBlocks((prev) => prev.filter((_, i) => i !== index));
                              setDirty(true);
                            }}
                          >
                            Entfernen
                          </Button>
                        </div>
                      )}
                    </div>
                    {(block.type === "heading" || block.type === "text") && (
                      <Textarea
                        className="mt-2"
                        rows={block.type === "text" ? 3 : 1}
                        disabled={isSystem}
                        value={block.text ?? ""}
                        onChange={(e) => patchBlock(index, { text: e.target.value })}
                      />
                    )}
                    {block.type === "button" && (
                      <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
                        <Input
                          className="h-11"
                          placeholder="Beschriftung"
                          disabled={isSystem}
                          value={block.label ?? ""}
                          onChange={(e) => patchBlock(index, { label: e.target.value })}
                        />
                        <Input
                          className="h-11"
                          placeholder="{{links.order}}"
                          disabled={isSystem}
                          value={block.url ?? ""}
                          onChange={(e) => patchBlock(index, { url: e.target.value })}
                        />
                      </div>
                    )}
                    {!["heading", "text", "button"].includes(block.type) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Inhalt kommt automatisch aus den Daten der Nachricht.
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {!isSystem && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="h-11" disabled={busy || !dirty} onClick={saveDraftNow}>
                    Entwurf speichern
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-11"
                    disabled={busy || !current || !!current.publishedAt}
                    onClick={() =>
                      run("Fassung veröffentlicht.", async () => {
                        await publish({
                          data: { organizationId, templateId, versionId: current!.id },
                        });
                        await template.refetch();
                      })
                    }
                  >
                    Veröffentlichen
                  </Button>
                </div>
              )}
            </Panel>

            <Panel title="Testmail senden" description="Testmails nutzen den eingestellten Anbieter. Der interne Testversand verlässt die Plattform nie.">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  className="h-11"
                  placeholder="empfaenger@example.com"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                />
                <Button
                  size="sm"
                  className="h-11 sm:shrink-0"
                  disabled={busy || !testRecipient}
                  onClick={() =>
                    run("Testmail erzeugt.", () =>
                      sendTest({
                        data: {
                          organizationId,
                          shopId,
                          templateKey: template.data!.key,
                          recipient: testRecipient,
                        },
                      }),
                    )
                  }
                >
                  Senden
                </Button>
              </div>
            </Panel>

            <Panel title="Verfügbare Variablen" bodyClassName="space-y-2">
              {VARIABLE_CATALOGUE.map((group) => (
                <div key={group.group} className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {group.group}
                  </p>
                  <p className="text-xs break-words">
                    {group.items.map((i) => `{{${i.path}}}`).join("  ")}
                  </p>
                </div>
              ))}
            </Panel>
          </>
        }
        aside={
          <Panel title="Vorschau" bodyClassName="space-y-2">
            {previewQuery.isLoading ? (
              <Skeleton className="h-[600px] w-full" />
            ) : previewQuery.data ? (
              <div className="min-w-0 overflow-hidden rounded-lg border border-border">
                <div className="border-b border-border bg-muted/50 px-3 py-2 text-xs">
                  <span className="font-medium">Betreff:</span>{" "}
                  <span className="break-words">{previewQuery.data.subject}</span>
                </div>
                <iframe
                  title="E-Mail-Vorschau"
                  srcDoc={previewQuery.data.html}
                  className="h-[600px] w-full bg-white"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Keine Vorschau verfügbar.</p>
            )}
          </Panel>
        }
      />

      {!isSystem && (
        <StickyActionBar className="sm:hidden">
          <Button className="h-11 w-full" disabled={busy || !dirty} onClick={saveDraftNow}>
            Entwurf speichern
          </Button>
        </StickyActionBar>
      )}
    </div>
  );
}
