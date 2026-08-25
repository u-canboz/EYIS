import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listTaxonomy,
  saveCategory,
  deleteCategory,
  saveCollection,
  deleteCollection,
} from "@/lib/commerce/taxonomy.functions";
import type { CategoryNode } from "@/lib/commerce/taxonomy.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/kategorien")({
  head: () => ({
    meta: [
      { title: "Kategorien & Kollektionen – Commerce OS" },
      {
        name: "description",
        content: "Kategoriebaum und Kollektionen deines Shops strukturieren und pflegen.",
      },
      { property: "og:title", content: "Kategorien & Kollektionen – Commerce OS" },
      { property: "og:description", content: "Struktur für deinen Produktkatalog." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaxonomyPage,
});

function TaxonomyPage() {
  const queryClient = useQueryClient();
  const { organizationId, shopId, can } = useActiveWorkspace();

  const [categoryName, setCategoryName] = useState("");
  const [parentId, setParentId] = useState("root");
  const [collectionName, setCollectionName] = useState("");

  const fetchTaxonomy = useServerFn(listTaxonomy);
  const runSaveCategory = useServerFn(saveCategory);
  const runDeleteCategory = useServerFn(deleteCategory);
  const runSaveCollection = useServerFn(saveCollection);
  const runDeleteCollection = useServerFn(deleteCollection);

  const taxonomyQuery = useQuery({
    queryKey: ["taxonomy", organizationId, shopId],
    enabled: Boolean(organizationId && shopId),
    queryFn: () => fetchTaxonomy({ data: { organizationId, shopId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["taxonomy"] });

  const categoryMutation = useMutation({
    mutationFn: () =>
      runSaveCategory({
        data: {
          organizationId,
          shopId,
          name: categoryName,
          parentId: parentId === "root" ? null : parentId,
        },
      }),
    onSuccess: () => {
      toast.success("Kategorie gespeichert.");
      setCategoryName("");
      setParentId("root");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const categoryDeleteMutation = useMutation({
    mutationFn: (categoryId: string) => runDeleteCategory({ data: { organizationId, categoryId } }),
    onSuccess: () => {
      toast.success("Kategorie gelöscht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const collectionMutation = useMutation({
    mutationFn: () => runSaveCollection({ data: { organizationId, shopId, name: collectionName } }),
    onSuccess: () => {
      toast.success("Kollektion gespeichert.");
      setCollectionName("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const collectionDeleteMutation = useMutation({
    mutationFn: (collectionId: string) =>
      runDeleteCollection({ data: { organizationId, collectionId } }),
    onSuccess: () => {
      toast.success("Kollektion gelöscht.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const canManage = can("categories.manage");
  const canManageCollections = can("collections.manage");

  const renderTree = (nodes: CategoryNode[], depth = 0) =>
    nodes.map((node) => (
      <div key={node.id}>
        <div
          className="flex items-center justify-between border-b py-2"
          style={{ paddingLeft: depth * 20 }}
        >
          <div>
            <span className="text-sm font-medium">{node.name}</span>
            <span className="ml-2 text-xs text-muted-foreground">/{node.handle}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{node.product_count}</Badge>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => categoryDeleteMutation.mutate(node.id)}
              >
                Löschen
              </Button>
            )}
          </div>
        </div>
        {node.children.length > 0 && renderTree(node.children, depth + 1)}
      </div>
    ));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-semibold">Kategorien & Kollektionen</h1>
        <p className="text-sm text-muted-foreground">
          Kategorien bilden die Struktur, Kollektionen gruppieren Produkte frei.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-6">
        <p className="font-medium">Kategorien</p>
        {taxonomyQuery.isLoading ? (
          <Skeleton className="mt-4 h-32 w-full" />
        ) : (
          <div className="mt-4">
            {(taxonomyQuery.data?.categories ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Kategorien angelegt.</p>
            ) : (
              renderTree(taxonomyQuery.data!.categories)
            )}
          </div>
        )}

        {canManage && (
          <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end">
            <div>
              <Label>Neue Kategorie</Label>
              <Input
                className="mt-2"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
              />
            </div>
            <div>
              <Label>Übergeordnet</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="root">Keine</SelectItem>
                  {(taxonomyQuery.data?.flatCategories ?? []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!categoryName.trim() || categoryMutation.isPending}
              onClick={() => categoryMutation.mutate()}
            >
              Hinzufügen
            </Button>
          </div>
        )}
      </section>

      <section className="rounded-lg border bg-card p-6">
        <p className="font-medium">Kollektionen</p>
        <div className="mt-4 space-y-2">
          {(taxonomyQuery.data?.collections ?? []).map((col) => (
            <div key={col.id} className="flex items-center justify-between border-b py-2">
              <div>
                <span className="text-sm font-medium">{col.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">/{col.handle}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{col.product_count}</Badge>
                {canManageCollections && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => collectionDeleteMutation.mutate(col.id)}
                  >
                    Löschen
                  </Button>
                )}
              </div>
            </div>
          ))}
          {(taxonomyQuery.data?.collections ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Noch keine Kollektionen angelegt.</p>
          )}
        </div>

        {canManageCollections && (
          <div className="mt-6 flex items-end gap-3">
            <div className="flex-1">
              <Label>Neue Kollektion</Label>
              <Input
                className="mt-2"
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
              />
            </div>
            <Button
              disabled={!collectionName.trim() || collectionMutation.isPending}
              onClick={() => collectionMutation.mutate()}
            >
              Hinzufügen
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
