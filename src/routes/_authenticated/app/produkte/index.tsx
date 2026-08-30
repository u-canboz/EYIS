import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listProducts, archiveProduct, duplicateProduct } from "@/lib/commerce/products.functions";
import { listBlueprints } from "@/lib/commerce/blueprints.functions";
import { listTaxonomy } from "@/lib/commerce/taxonomy.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { EmptyState, ErrorState, ListSkeleton, PermissionState } from "@/eyis/data/States";
import { FilterBar } from "@/eyis/data/FilterBar";
import { SectionPanel } from "@/eyis/data/SectionPanel";
import { RecordList, RecordRow, RecordThumb } from "@/eyis/data/RecordRow";
import { ActionMenu } from "@/eyis/data/ActionMenu";

export const Route = createFileRoute("/_authenticated/app/produkte/")({
  head: () => ({
    meta: [
      { title: "Produkte – EYIS Backoffice" },
      {
        name: "description",
        content: "Alle Produkte deines Shops filtern, bearbeiten, duplizieren und archivieren.",
      },
      { property: "og:title", content: "Produkte – EYIS Backoffice" },
      {
        property: "og:description",
        content: "Katalogverwaltung mit Blueprints, Varianten und Medien.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProductsPage,
});

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  archived: "Archiviert",
};

function ProductsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organizationId, shopId, can, isLoading: workspaceLoading } = useActiveWorkspace();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "draft" | "active" | "archived">("all");
  const [blueprintKey, setBlueprintKey] = useState("all");
  const [categoryId, setCategoryId] = useState("all");
  const [page, setPage] = useState(1);

  const fetchProducts = useServerFn(listProducts);
  const fetchBlueprints = useServerFn(listBlueprints);
  const fetchTaxonomy = useServerFn(listTaxonomy);
  const runArchive = useServerFn(archiveProduct);
  const runDuplicate = useServerFn(duplicateProduct);

  const productsQuery = useQuery({
    queryKey: ["products", organizationId, shopId, search, status, blueprintKey, categoryId, page],
    enabled: Boolean(organizationId),
    queryFn: () =>
      fetchProducts({
        data: { organizationId, shopId, search, status, blueprintKey, categoryId, page },
      }),
  });

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

  const archiveMutation = useMutation({
    mutationFn: (productId: string) => runArchive({ data: { productId, organizationId } }),
    onSuccess: () => {
      toast.success("Produkt archiviert.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateMutation = useMutation({
    mutationFn: (productId: string) => runDuplicate({ data: { productId, organizationId } }),
    onSuccess: (result) => {
      toast.success("Produkt dupliziert.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      navigate({ to: "/app/produkte/$productId", params: { productId: result.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const items = productsQuery.data?.items ?? [];
  const total = productsQuery.data?.total ?? 0;
  const pageSize = productsQuery.data?.pageSize ?? 25;
  const canCreate = can("products.create");

  const activeFilters =
    (status !== "all" ? 1 : 0) + (blueprintKey !== "all" ? 1 : 0) + (categoryId !== "all" ? 1 : 0);

  if (!workspaceLoading && !can("products.read")) {
    return <PermissionState what="Produkte" />;
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Produkte"
        description={`${total} ${total === 1 ? "Produkt" : "Produkte"} im aktiven Shop.`}
        actions={
          canCreate ? (
            <Button asChild className="h-11">
              <Link to="/app/produkte/neu">Neues Produkt</Link>
            </Button>
          ) : null
        }
      />

      <FilterBar
        activeCount={activeFilters}
        onReset={() => {
          setStatus("all");
          setBlueprintKey("all");
          setCategoryId("all");
          setPage(1);
        }}
        search={
          <Input
            className="h-11 w-full"
            placeholder="Name oder Handle suchen"
            aria-label="Produkte suchen"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        }
        filters={
          <>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as typeof status);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Status" className="h-11 w-full md:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="draft">Entwurf</SelectItem>
                <SelectItem value="active">Aktiv</SelectItem>
                <SelectItem value="archived">Archiviert</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={blueprintKey}
              onValueChange={(v) => {
                setBlueprintKey(v);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Produktart" className="h-11 w-full md:w-44">
                <SelectValue placeholder="Produktart" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Produktarten</SelectItem>
                {(blueprintsQuery.data ?? []).map((bp) => (
                  <SelectItem key={bp.key} value={bp.key}>
                    {bp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={categoryId}
              onValueChange={(v) => {
                setCategoryId(v);
                setPage(1);
              }}
            >
              <SelectTrigger aria-label="Kategorie" className="h-11 w-full md:w-44">
                <SelectValue placeholder="Kategorie" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Kategorien</SelectItem>
                {(taxonomyQuery.data?.flatCategories ?? []).map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {workspaceLoading || productsQuery.isLoading ? (
        <ListSkeleton />
      ) : productsQuery.error ? (
        <ErrorState description={(productsQuery.error as Error).message} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Noch keine Produkte"
          description="Lege dein erstes Produkt an – der Assistent führt dich durch Vorlage, Details und Varianten."
          action={
            canCreate ? (
              <Button asChild className="min-h-11">
                <Link to="/app/produkte/neu">Produkt anlegen</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <SectionPanel flush>
          <RecordList>
            {items.map((item) => (
              <RecordRow
                key={item.id}
                to="/app/produkte/$productId"
                params={{ productId: item.id }}
                leading={<RecordThumb src={item.cover_url} alt={item.name} />}
                title={item.name}
                subtitle={`/${item.handle} · ${item.variant_count} ${
                  item.variant_count === 1 ? "Variante" : "Varianten"
                }${item.categories.length ? ` · ${item.categories.join(", ")}` : ""}`}
                badges={
                  item.status === "active" ? null : (
                    <Badge variant="secondary">{STATUS_LABEL[item.status]}</Badge>
                  )
                }
                actions={
                  <ActionMenu
                    label={`Aktionen für ${item.name}`}
                    items={[
                      ...(canCreate
                        ? [
                            {
                              label: "Duplizieren",
                              onSelect: () => duplicateMutation.mutate(item.id),
                              disabled: duplicateMutation.isPending,
                            },
                          ]
                        : []),
                      ...(can("products.archive") && item.status !== "archived"
                        ? [
                            {
                              label: "Archivieren",
                              onSelect: () => archiveMutation.mutate(item.id),
                              disabled: archiveMutation.isPending,
                              destructive: true,
                              separatorBefore: true,
                            },
                          ]
                        : []),
                    ]}
                  />
                }
              />
            ))}
          </RecordList>
        </SectionPanel>
      )}


      {total > pageSize && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Zurück
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Seite {page} von {Math.ceil(total / pageSize)}
          </span>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(page + 1)}
          >
            Weiter
          </Button>
        </div>
      )}
    </div>
  );
}
