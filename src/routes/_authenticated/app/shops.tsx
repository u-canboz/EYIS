import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  getWorkspace,
  updateShop,
  listDomains,
  addDomain,
  removeDomain,
} from "@/lib/commerce/workspace.functions";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/shops")({
  head: () => ({
    meta: [
      { title: "Shops & Domains – Commerce OS" },
      {
        name: "description",
        content: "Shops der Organisation konfigurieren: Name, Währung, Sprache und Domains.",
      },
      { property: "og:title", content: "Shops & Domains – Commerce OS" },
      {
        property: "og:description",
        content: "Shops der Organisation konfigurieren: Name, Währung, Sprache und Domains.",
      },
    ],
  }),
  component: ShopsPage,
});

function ShopsPage() {
  const { orgId } = useWorkspaceStore();
  const qc = useQueryClient();
  const fetchWorkspace = useServerFn(getWorkspace);
  const save = useServerFn(updateShop);

  const workspace = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
  const shops = (workspace.data?.shops ?? []).filter((s) => s.organization_id === orgId);
  const canManage = workspace.data?.organizations
    .find((o) => o.id === orgId)
    ?.permissions.includes("settings.manage");

  const [draft, setDraft] = useState<Record<string, Partial<(typeof shops)[number]>>>({});

  const saveMutation = useMutation({
    mutationFn: (shop: (typeof shops)[number]) =>
      save({
        data: {
          shopId: shop.id,
          organizationId: orgId,
          name: shop.name,
          slug: shop.slug,
          currency: shop.currency,
          locale: shop.locale,
          status: shop.status as "active" | "inactive" | "archived",
        },
      }),
    onSuccess: () => {
      toast.success("Shop gespeichert.");
      qc.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (workspace.isLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold">Shops</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Jeder Shop gehört genau einer Organisation und ist strikt gegen andere Mandanten isoliert.
        </p>
      </header>

      {shops.map((shop) => {
        const merged = { ...shop, ...draft[shop.id] } as typeof shop;
        const patch = (v: Partial<typeof shop>) =>
          setDraft((d) => ({ ...d, [shop.id]: { ...d[shop.id], ...v } }));
        return (
          <Card key={shop.id}>
            <CardHeader>
              <CardTitle className="text-base">{shop.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={merged.name}
                    disabled={!canManage}
                    onChange={(e) => patch({ name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input
                    value={merged.slug}
                    disabled={!canManage}
                    onChange={(e) => patch({ slug: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Währung</Label>
                  <Input
                    value={merged.currency}
                    disabled={!canManage}
                    onChange={(e) => patch({ currency: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Sprache</Label>
                  <Input
                    value={merged.locale}
                    disabled={!canManage}
                    onChange={(e) => patch({ locale: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={merged.status}
                    disabled={!canManage}
                    onValueChange={(v) => patch({ status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">aktiv</SelectItem>
                      <SelectItem value="inactive">inaktiv</SelectItem>
                      <SelectItem value="archived">archiviert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {canManage && (
                <Button onClick={() => saveMutation.mutate(merged)} disabled={saveMutation.isPending}>
                  Speichern
                </Button>
              )}

              <Domains shopId={shop.id} orgId={orgId} canManage={!!canManage} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Domains({
  shopId,
  orgId,
  canManage,
}: {
  shopId: string;
  orgId: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const list = useServerFn(listDomains);
  const add = useServerFn(addDomain);
  const remove = useServerFn(removeDomain);
  const [domain, setDomain] = useState("");

  const domains = useQuery({
    queryKey: ["domains", shopId],
    queryFn: () => list({ data: { shopId } }),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["domains", shopId] });

  const addMutation = useMutation({
    mutationFn: () =>
      add({
        data: {
          shopId,
          organizationId: orgId,
          domain,
          isPrimary: (domains.data ?? []).length === 0,
        },
      }),
    onSuccess: () => {
      setDomain("");
      toast.success("Domain hinzugefügt.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: (domainId: string) => remove({ data: { domainId, organizationId: orgId } }),
    onSuccess: () => {
      toast.success("Domain entfernt.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-md border p-4">
      <p className="text-sm font-medium">Domains</p>
      <div className="mt-3 space-y-2">
        {(domains.data ?? []).map((d) => (
          <div key={d.id} className="flex items-center justify-between text-sm">
            <span>
              {d.domain} {d.is_primary && <span className="text-muted-foreground">· primär</span>}
            </span>
            {canManage && (
              <Button size="sm" variant="ghost" onClick={() => removeMutation.mutate(d.id)}>
                Entfernen
              </Button>
            )}
          </div>
        ))}
        {(domains.data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Domain hinterlegt.</p>
        )}
      </div>
      {canManage && (
        <div className="mt-3 flex gap-2">
          <Input
            value={domain}
            placeholder="shop.beispiel.de"
            onChange={(e) => setDomain(e.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => addMutation.mutate()}
            disabled={!domain || addMutation.isPending}
          >
            Hinzufügen
          </Button>
        </div>
      )}
    </div>
  );
}
