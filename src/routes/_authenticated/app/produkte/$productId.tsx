import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getProduct, updateProduct } from "@/lib/commerce/products.functions";
import { getBlueprintVersion } from "@/lib/commerce/blueprints.functions";
import {
  saveOptions,
  generateVariants,
  updateVariant,
  removeVariant,
} from "@/lib/commerce/variants.functions";
import { listTaxonomy } from "@/lib/commerce/taxonomy.functions";
import { listMedia, attachMedia, detachMedia, reorderProductMedia } from "@/lib/commerce/media.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { BlueprintForm } from "@/components/commerce/BlueprintForm";
import type { BlueprintData } from "@/lib/commerce/blueprint-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingTab } from "@/components/commerce/PricingTab";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/app/produkte/$productId")({
  head: () => ({
    meta: [
      { title: "Produkt bearbeiten – Commerce OS" },
      {
        name: "description",
        content: "Details, Varianten, Medien, Organisation und SEO eines Produkts bearbeiten.",
      },
      { property: "og:title", content: "Produkt bearbeiten – Commerce OS" },
      { property: "og:description", content: "Produktdetails, Varianten und Medien pflegen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductEditor,
});

function ProductEditor() {
  const { productId } = Route.useParams();
  const queryClient = useQueryClient();
  const { organizationId, shopId, shops, can } = useActiveWorkspace();

  const fetchProduct = useServerFn(getProduct);
  const fetchBlueprint = useServerFn(getBlueprintVersion);
  const fetchTaxonomy = useServerFn(listTaxonomy);
  const runUpdate = useServerFn(updateProduct);

  const productQuery = useQuery({
    queryKey: ["product", productId],
    queryFn: () => fetchProduct({ data: { productId } }),
  });

  const product = productQuery.data?.product;

  const blueprintQuery = useQuery({
    queryKey: ["blueprint", product?.blueprint_key, product?.blueprint_version, organizationId],
    enabled: Boolean(product && organizationId),
    queryFn: () =>
      fetchBlueprint({
        data: {
          key: product!.blueprint_key,
          version: product!.blueprint_version,
          organizationId,
        },
      }),
  });

  const taxonomyQuery = useQuery({
    queryKey: ["taxonomy", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchTaxonomy({ data: { organizationId, shopId } }),
  });

  const [form, setForm] = useState({
    name: "",
    handle: "",
    subtitle: "",
    description: "",
    vendor: "",
    status: "draft" as "draft" | "active" | "archived",
    seoTitle: "",
    seoDescription: "",
  });
  const [blueprintData, setBlueprintData] = useState<BlueprintData>({});
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [collectionIds, setCollectionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!productQuery.data) return;
    const p = productQuery.data.product;
    setForm({
      name: p.name,
      handle: p.handle,
      subtitle: p.subtitle ?? "",
      description: p.description ?? "",
      vendor: p.vendor ?? "",
      status: p.status,
      seoTitle: p.seo_title ?? "",
      seoDescription: p.seo_description ?? "",
    });
    setBlueprintData((p.blueprint_data ?? {}) as BlueprintData);
    setCategoryIds(productQuery.data.categoryIds);
    setCollectionIds(productQuery.data.collectionIds);
  }, [productQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      runUpdate({
        data: {
          productId,
          organizationId,
          name: form.name,
          handle: form.handle,
          subtitle: form.subtitle,
          description: form.description,
          vendor: form.vendor,
          status: form.status,
          seoTitle: form.seoTitle,
          seoDescription: form.seoDescription,
          blueprintData,
          categoryIds,
          collectionIds,
        },
      }),
    onSuccess: () => {
      toast.success("Produkt gespeichert.");
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (productQuery.isLoading || !product) return <Skeleton className="h-96 w-full" />;

  const canEdit = can("products.update");

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/app/produkte" className="text-sm text-muted-foreground hover:underline">
            ← Zurück zur Übersicht
          </Link>
          <h1 className="font-display text-2xl font-semibold">{form.name}</h1>
          <p className="text-sm text-muted-foreground">
            Vorlage: {product.blueprint_key} (v{product.blueprint_version})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={form.status}
            onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
            disabled={!canEdit}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Entwurf</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="archived">Archiviert</SelectItem>
            </SelectContent>
          </Select>
          <Button disabled={!canEdit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Speichert…" : "Speichern"}
          </Button>
        </div>
      </header>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="varianten">Varianten</TabsTrigger>
          <TabsTrigger value="preise">Preise</TabsTrigger>
          <TabsTrigger value="medien">Medien</TabsTrigger>
          <TabsTrigger value="organisation">Organisation</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-6 pt-4">
          <div className="grid gap-5 rounded-lg border bg-card p-6 sm:grid-cols-2">
            <div>
              <Label>Produktname</Label>
              <Input
                className="mt-2"
                value={form.name}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label>Handle</Label>
              <Input
                className="mt-2"
                value={form.handle}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, handle: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Untertitel</Label>
              <Input
                className="mt-2"
                value={form.subtitle}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Beschreibung</Label>
              <Textarea
                className="mt-2"
                rows={5}
                value={form.description}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <Label>Hersteller / Marke</Label>
              <Input
                className="mt-2"
                value={form.vendor}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </div>
          </div>

          {blueprintQuery.data && (
            <div className="rounded-lg border bg-card p-6">
              <BlueprintForm
                schema={blueprintQuery.data.schema}
                value={blueprintData}
                onChange={setBlueprintData}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="varianten" className="pt-4">
          <VariantsTab
            productId={productId}
            organizationId={organizationId}
            canEdit={canEdit}
            options={productQuery.data!.options as never}
            variants={productQuery.data!.variants as never}
            axes={blueprintQuery.data?.variant_schema?.axes ?? []}
          />
        </TabsContent>

        <TabsContent value="preise" className="pt-4">
          <PricingTab
            productId={productId}
            organizationId={organizationId}
            shopId={shopId}
            currency={shops[0]?.currency ?? "EUR"}
            canEdit={can("pricing.manage")}
          />
        </TabsContent>

        <TabsContent value="medien" className="pt-4">
          <MediaTab
            productId={productId}
            organizationId={organizationId}
            shopId={shopId}
            canEdit={canEdit}
            media={productQuery.data!.media}
          />
        </TabsContent>

        <TabsContent value="organisation" className="space-y-6 pt-4">
          <div className="rounded-lg border bg-card p-6">
            <p className="font-medium">Kategorien</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(taxonomyQuery.data?.flatCategories ?? []).map((cat) => (
                <label key={cat.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={categoryIds.includes(cat.id)}
                    disabled={!canEdit}
                    onCheckedChange={(checked) =>
                      setCategoryIds(
                        checked ? [...categoryIds, cat.id] : categoryIds.filter((i) => i !== cat.id),
                      )
                    }
                  />
                  {cat.name}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <p className="font-medium">Kollektionen</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {(taxonomyQuery.data?.collections ?? []).map((col) => (
                <label key={col.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={collectionIds.includes(col.id)}
                    disabled={!canEdit}
                    onCheckedChange={(checked) =>
                      setCollectionIds(
                        checked
                          ? [...collectionIds, col.id]
                          : collectionIds.filter((i) => i !== col.id),
                      )
                    }
                  />
                  {col.name}
                </label>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="seo" className="pt-4">
          <div className="space-y-5 rounded-lg border bg-card p-6">
            <div>
              <Label>SEO-Titel</Label>
              <Input
                className="mt-2"
                value={form.seoTitle}
                disabled={!canEdit}
                maxLength={60}
                onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">{form.seoTitle.length}/60 Zeichen</p>
            </div>
            <div>
              <Label>SEO-Beschreibung</Label>
              <Textarea
                className="mt-2"
                rows={3}
                maxLength={160}
                value={form.seoDescription}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {form.seoDescription.length}/160 Zeichen
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

type OptionRow = {
  id: string;
  name: string;
  key: string;
  display_type: string;
  product_option_values: { id: string; value: string; position: number }[];
};

type VariantRow = {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  status: "active" | "inactive" | "archived";
};

function VariantsTab({
  productId,
  organizationId,
  canEdit,
  options,
  variants,
  axes,
}: {
  productId: string;
  organizationId: string;
  canEdit: boolean;
  options: OptionRow[];
  variants: VariantRow[];
  axes: { key: string; name: string; presets?: string[]; display_type?: string }[];
}) {
  const queryClient = useQueryClient();
  const runSaveOptions = useServerFn(saveOptions);
  const runGenerate = useServerFn(generateVariants);
  const runUpdateVariant = useServerFn(updateVariant);
  const runRemoveVariant = useServerFn(removeVariant);

  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      options.map((o) => [o.key, o.product_option_values.map((v) => v.value).join(", ")]),
    ),
  );

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["product", productId] });

  const optionsMutation = useMutation({
    mutationFn: async () => {
      const list = Object.entries(draft)
        .map(([key, raw]) => ({
          key,
          name: axes.find((a) => a.key === key)?.name ?? options.find((o) => o.key === key)?.name ?? key,
          display_type: axes.find((a) => a.key === key)?.display_type ?? "list",
          values: raw.split(",").map((v) => v.trim()).filter(Boolean),
        }))
        .filter((axis) => axis.values.length > 0);
      await runSaveOptions({ data: { productId, organizationId, axes: list } });
      return runGenerate({ data: { productId, organizationId } });
    },
    onSuccess: (result) => {
      toast.success(`${result.created} neue Varianten erzeugt.`);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const variantMutation = useMutation({
    mutationFn: (input: { variantId: string; sku?: string; barcode?: string; status?: VariantRow["status"] }) =>
      runUpdateVariant({ data: { organizationId, ...input } }),
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: (variantId: string) => runRemoveVariant({ data: { variantId, organizationId } }),
    onSuccess: () => {
      toast.success("Variante entfernt.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const axisKeys = Array.from(new Set([...axes.map((a) => a.key), ...options.map((o) => o.key)]));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <p className="font-medium">Optionen</p>
        <p className="text-sm text-muted-foreground">
          Werte mit Komma trennen. Bestehende Varianten bleiben erhalten, fehlende werden ergänzt.
        </p>
        <div className="mt-4 space-y-3">
          {axisKeys.map((key) => (
            <div key={key}>
              <Label>{axes.find((a) => a.key === key)?.name ?? key}</Label>
              <Input
                className="mt-2"
                disabled={!canEdit}
                value={draft[key] ?? ""}
                placeholder={(axes.find((a) => a.key === key)?.presets ?? []).join(", ")}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
              />
            </div>
          ))}
        </div>
        <Button
          className="mt-4"
          disabled={!canEdit || optionsMutation.isPending}
          onClick={() => optionsMutation.mutate()}
        >
          {optionsMutation.isPending ? "Erzeuge…" : "Varianten erzeugen"}
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {variants.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Noch keine Varianten.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Variante</TableHead>
                <TableHead>Artikelnummer</TableHead>
                <TableHead>Barcode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id}>
                  <TableCell className="font-medium">{variant.title}</TableCell>
                  <TableCell>
                    <Input
                      defaultValue={variant.sku ?? ""}
                      disabled={!canEdit}
                      onBlur={(e) =>
                        e.target.value !== (variant.sku ?? "") &&
                        variantMutation.mutate({ variantId: variant.id, sku: e.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      defaultValue={variant.barcode ?? ""}
                      disabled={!canEdit}
                      onBlur={(e) =>
                        e.target.value !== (variant.barcode ?? "") &&
                        variantMutation.mutate({ variantId: variant.id, barcode: e.target.value })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={variant.status}
                      disabled={!canEdit}
                      onValueChange={(v) =>
                        variantMutation.mutate({
                          variantId: variant.id,
                          status: v as VariantRow["status"],
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Aktiv</SelectItem>
                        <SelectItem value="inactive">Inaktiv</SelectItem>
                        <SelectItem value="archived">Archiviert</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canEdit}
                      onClick={() => removeMutation.mutate(variant.id)}
                    >
                      Entfernen
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function MediaTab({
  productId,
  organizationId,
  shopId,
  canEdit,
  media,
}: {
  productId: string;
  organizationId: string;
  shopId: string;
  canEdit: boolean;
  media: {
    id: string;
    position: number;
    filename: string;
    alt_text: string | null;
    url: string | null;
  }[];
}) {
  const queryClient = useQueryClient();
  const fetchMedia = useServerFn(listMedia);
  const runAttach = useServerFn(attachMedia);
  const runDetach = useServerFn(detachMedia);
  const runReorder = useServerFn(reorderProductMedia);

  const libraryQuery = useQuery({
    queryKey: ["media", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => fetchMedia({ data: { organizationId } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["product", productId] });
    queryClient.invalidateQueries({ queryKey: ["media", organizationId] });
  };

  const attachMutation = useMutation({
    mutationFn: (mediaIds: string[]) =>
      runAttach({ data: { organizationId, productId, mediaIds } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const detachMutation = useMutation({
    mutationFn: (productMediaId: string) =>
      runDetach({ data: { organizationId, productMediaId } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const reorderMutation = useMutation({
    mutationFn: (ids: string[]) => runReorder({ data: { organizationId, productMediaIds: ids } }),
    onSuccess: invalidate,
    onError: (error: Error) => toast.error(error.message),
  });

  const move = (index: number, direction: -1 | 1) => {
    const ids = media.map((m) => m.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    reorderMutation.mutate(ids);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-card p-6">
        <p className="font-medium">Produktgalerie</p>
        <p className="text-sm text-muted-foreground">Das erste Bild ist das Titelbild.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item, index) => (
            <div key={item.id} className="rounded-md border p-2">
              {item.url ? (
                <img
                  src={item.url}
                  alt={item.alt_text ?? item.filename}
                  className="aspect-square w-full rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-square w-full rounded bg-muted" />
              )}
              <p className="mt-2 truncate text-xs">{item.filename}</p>
              {canEdit && (
                <div className="mt-2 flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => move(index, -1)}>
                    ←
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => move(index, 1)}>
                    →
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => detachMutation.mutate(item.id)}
                  >
                    Lösen
                  </Button>
                </div>
              )}
            </div>
          ))}
          {media.length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Bilder zugeordnet.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="font-medium">Medienbibliothek</p>
          <Link to="/app/medien" className="text-sm text-muted-foreground hover:underline">
            Dateien hochladen
          </Link>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {(libraryQuery.data ?? []).map((asset) => (
            <button
              key={asset.id}
              type="button"
              disabled={!canEdit}
              onClick={() => attachMutation.mutate([asset.id])}
              className="rounded-md border p-1 text-left hover:border-primary"
              title={`${asset.filename} zu diesem Produkt hinzufügen`}
            >
              {asset.url ? (
                <img
                  src={asset.url}
                  alt={asset.alt_text ?? asset.filename}
                  className="aspect-square w-full rounded object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="aspect-square w-full rounded bg-muted" />
              )}
            </button>
          ))}
          {(libraryQuery.data ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Die Bibliothek ist leer. {shopId ? "" : ""}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
