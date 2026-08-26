import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listBlueprints } from "@/lib/commerce/blueprints.functions";
import { createProduct } from "@/lib/commerce/products.functions";
import { saveOptions, generateVariants } from "@/lib/commerce/variants.functions";
import { listTaxonomy } from "@/lib/commerce/taxonomy.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { BlueprintForm } from "@/components/commerce/BlueprintForm";
import { BLUEPRINT_GROUPS } from "@/lib/commerce/blueprint-types";
import type { Blueprint, BlueprintData } from "@/lib/commerce/blueprint-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/app/produkte/neu")({
  head: () => ({
    meta: [
      { title: "Neues Produkt anlegen – Commerce OS" },
      {
        name: "description",
        content:
          "Assistent für neue Produkte: Vorlage wählen, Details ausfüllen, Varianten erzeugen.",
      },
      { property: "og:title", content: "Neues Produkt anlegen – Commerce OS" },
      {
        property: "og:description",
        content: "Produktassistent mit Blueprints und Variantenmatrix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductWizard,
});

const STEPS = ["Produktart", "Basisdaten", "Details", "Varianten", "Zusammenfassung"];

function ProductWizard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId, shopId, isLoading } = useActiveWorkspace();

  const [step, setStep] = useState(0);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [blueprintData, setBlueprintData] = useState<BlueprintData>({});
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [axisValues, setAxisValues] = useState<Record<string, string[]>>({});

  const fetchBlueprints = useServerFn(listBlueprints);
  const fetchTaxonomy = useServerFn(listTaxonomy);
  const runCreate = useServerFn(createProduct);
  const runSaveOptions = useServerFn(saveOptions);
  const runGenerate = useServerFn(generateVariants);

  const blueprintsQuery = useQuery({
    queryKey: ["blueprints", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fetchBlueprints({ data: { organizationId } }),
  });

  const taxonomyQuery = useQuery({
    queryKey: ["taxonomy", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchTaxonomy({ data: { organizationId, shopId } }),
  });

  const grouped = useMemo(() => {
    const all = blueprintsQuery.data ?? [];
    const known = new Set(BLUEPRINT_GROUPS.flatMap((g) => g.keys));
    return [
      ...BLUEPRINT_GROUPS.map((group) => ({
        label: group.label,
        items: all.filter((bp) => group.keys.includes(bp.key)),
      })),
      { label: "Eigene Vorlagen", items: all.filter((bp) => !known.has(bp.key)) },
    ].filter((group) => group.items.length > 0);
  }, [blueprintsQuery.data]);

  const axes = blueprint?.variant_schema?.axes ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!blueprint) throw new Error("Bitte wähle eine Produktart.");
      const created = await runCreate({
        data: {
          organizationId,
          shopId,
          blueprintKey: blueprint.key,
          blueprintId: blueprint.id,
          blueprintVersion: blueprint.version,
          name,
          subtitle,
          description,
          vendor,
          blueprintData,
          categoryIds,
        },
      });

      const activeAxes = axes
        .filter((axis) => (axisValues[axis.key] ?? []).length > 0)
        .map((axis) => ({
          key: axis.key,
          name: axis.name,
          display_type: axis.display_type ?? "list",
          values: axisValues[axis.key]!,
        }));

      if (activeAxes.length) {
        await runSaveOptions({ data: { productId: created.id, organizationId, axes: activeAxes } });
        await runGenerate({ data: { productId: created.id, organizationId } });
      }
      return created;
    },
    onSuccess: (created) => {
      toast.success("Produkt angelegt.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/app/produkte/$productId", params: { productId: created.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const variantCount = axes.reduce(
    (acc, axis) => acc * Math.max((axisValues[axis.key] ?? []).length, 1),
    1,
  );

  const canContinue =
    (step === 0 && Boolean(blueprint)) || (step === 1 && name.trim().length > 1) || step > 1;

  if (isLoading) return <Skeleton className="h-72 w-full rounded-xl" />;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Neues Produkt"
        description={`Schritt ${step + 1} von ${STEPS.length}: ${STEPS[step]}`}
      />

      <ol className="grid grid-cols-5 gap-1.5" aria-label="Fortschritt">
        {STEPS.map((label, index) => (
          <li key={label} className="min-w-0">
            <div
              className={`h-1.5 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
              aria-hidden
            />
            <p
              className={`mt-1.5 truncate text-[11px] ${
                index === step ? "font-medium text-foreground" : "text-muted-foreground"
              }`}
            >
              {label}
            </p>
          </li>
        ))}
      </ol>

      <Panel bodyClassName="p-4 sm:p-6">
        {step === 0 && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">Was möchtest du verkaufen?</p>

            {blueprintsQuery.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              grouped.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((bp) => (
                      <button
                        key={bp.id}
                        type="button"
                        onClick={() => {
                          setBlueprint(bp);
                          setBlueprintData({});
                          setAxisValues({});
                        }}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          blueprint?.id === bp.id
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/40"
                        }`}
                      >
                        <p className="font-medium">{bp.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{bp.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {step === 1 && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Produktname *</Label>
              <Input className="mt-2" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Untertitel</Label>
              <Input
                className="mt-2"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Beschreibung</Label>
              <Textarea
                className="mt-2"
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div>
              <Label>Hersteller / Marke</Label>
              <Input className="mt-2" value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Kategorien</Label>
              <div className="mt-2 flex flex-wrap gap-3">
                {(taxonomyQuery.data?.flatCategories ?? []).map((cat) => (
                  <label key={cat.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={categoryIds.includes(cat.id)}
                      onCheckedChange={(checked) =>
                        setCategoryIds(
                          checked
                            ? [...categoryIds, cat.id]
                            : categoryIds.filter((id) => id !== cat.id),
                        )
                      }
                    />
                    {cat.name}
                  </label>
                ))}
                {(taxonomyQuery.data?.flatCategories ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Noch keine Kategorien angelegt – das kannst du später nachholen.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && blueprint && (
          <BlueprintForm
            schema={blueprint.schema}
            value={blueprintData}
            onChange={setBlueprintData}
          />
        )}

        {step === 3 && (
          <div className="space-y-5">
            {axes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Diese Produktart sieht keine Varianten vor.
              </p>
            ) : (
              axes.map((axis) => {
                const selected = axisValues[axis.key] ?? [];
                return (
                  <div key={axis.key} className="rounded-md border p-4">
                    <p className="font-medium">{axis.name}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(axis.presets ?? []).map((preset) => {
                        const active = selected.includes(preset);
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() =>
                              setAxisValues({
                                ...axisValues,
                                [axis.key]: active
                                  ? selected.filter((v) => v !== preset)
                                  : [...selected, preset],
                              })
                            }
                            className={`rounded-full border px-3 py-1 text-sm ${
                              active ? "border-primary bg-primary/10" : "hover:border-primary/40"
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                    <Input
                      className="mt-3"
                      placeholder="Eigene Werte, mit Komma getrennt"
                      value={selected.filter((v) => !(axis.presets ?? []).includes(v)).join(", ")}
                      onChange={(e) => {
                        const custom = e.target.value
                          .split(",")
                          .map((v) => v.trim())
                          .filter(Boolean);
                        const presets = selected.filter((v) => (axis.presets ?? []).includes(v));
                        setAxisValues({ ...axisValues, [axis.key]: [...presets, ...custom] });
                      }}
                    />
                  </div>
                );
              })
            )}
            {axes.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Es entstehen <strong>{variantCount}</strong> Varianten.
              </p>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Produktart:</span> {blueprint?.name}
            </p>
            <p>
              <span className="text-muted-foreground">Name:</span> {name}
            </p>
            <p>
              <span className="text-muted-foreground">Kategorien:</span> {categoryIds.length}
            </p>
            <p>
              <span className="text-muted-foreground">Varianten:</span>{" "}
              {axes.length ? variantCount : 0}
            </p>
            <p className="text-muted-foreground">
              Das Produkt wird als Entwurf gespeichert und kann danach vollständig bearbeitet
              werden.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => (step === 0 ? navigate({ to: "/app/produkte" }) : setStep(step - 1))}
        >
          {step === 0 ? "Abbrechen" : "Zurück"}
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canContinue} onClick={() => setStep(step + 1)}>
            Weiter
          </Button>
        ) : (
          <Button disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? "Wird angelegt…" : "Produkt anlegen"}
          </Button>
        )}
      </div>
    </div>
  );
}
