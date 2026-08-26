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
import { Skeleton } from "@/components/ui/skeleton";
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

export const Route = createFileRoute("/_authenticated/app/produkte/")({
  head: () => ({
    meta: [
      { title: "Produkte – Commerce OS Backoffice" },
      {
        name: "description",
        content: "Alle Produkte deines Shops filtern, bearbeiten, duplizieren und archivieren.",
      },
      { property: "og:title", content: "Produkte – Commerce OS Backoffice" },
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
              <SelectTrigger className="h-11 w-full md:w-44">
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
              <SelectTrigger className="h-11 w-full md:w-44">
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
              <SelectTrigger className="h-11 w-full md:w-44">
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


      <div className="rounded-lg border bg-card">
        {workspaceLoading || productsQuery.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-medium">Noch keine Produkte</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Lege dein erstes Produkt an – der Assistent führt dich durch Vorlage, Details und
              Varianten.
            </p>
            {canCreate && (
              <Button asChild className="mt-4">
                <Link to="/app/produkte/neu">Produkt anlegen</Link>
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Varianten</TableHead>
                <TableHead>Kategorien</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.name}
                        className="h-10 w-10 rounded object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Link
                      to="/app/produkte/$productId"
                      params={{ productId: item.id }}
                      className="font-medium hover:underline"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">/{item.handle}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.status === "active" ? "default" : "secondary"}>
                      {STATUS_LABEL[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.variant_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.categories.join(", ") || "–"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canCreate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={duplicateMutation.isPending}
                          onClick={() => duplicateMutation.mutate(item.id)}
                        >
                          Duplizieren
                        </Button>
                      )}
                      {can("products.archive") && item.status !== "archived" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={archiveMutation.isPending}
                          onClick={() => archiveMutation.mutate(item.id)}
                        >
                          Archivieren
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {total > pageSize && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Zurück
          </Button>
          <span className="text-sm text-muted-foreground">
            Seite {page} von {Math.ceil(total / pageSize)}
          </span>
          <Button
            variant="outline"
            size="sm"
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
