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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { Panel } from "@/eyis/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/shops")({
  head: () => ({
    meta: [
      { title: "Shops & Domains – EYIS" },
      {
        name: "description",
        content: "Shops der Organisation konfigurieren: Name, Währung, Sprache und Domains.",
      },
      { property: "og:title", content: "Shops & Domains – EYIS" },
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

  if (workspace.isLoading) return <ListSkeleton />;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Shops"
        description="Jeder Shop gehört genau einer Organisation und ist strikt gegen andere Mandanten isoliert."
      />

      {shops.length === 0 ? (
        <EmptyState title="Keine Shops" description="Für diese Organisation ist noch kein Shop angelegt." />
      ) : (
        shops.map((shop) => {
          const merged = { ...shop, ...draft[shop.id] } as typeof shop;
          const patch = (v: Partial<typeof shop>) =>
            setDraft((d) => ({ ...d, [shop.id]: { ...d[shop.id], ...v } }));
          return (
            <Panel key={shop.id} title={shop.name}>
              <div className="min-w-0 space-y-4">
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0 space-y-2">
                    <Label>Name</Label>
                    <Input
                      className="h-11"
                      value={merged.name}
                      disabled={!canManage}
                      onChange={(e) => patch({ name: e.target.value })}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Slug</Label>
                    <Input
                      className="h-11"
                      value={merged.slug}
                      disabled={!canManage}
                      onChange={(e) => patch({ slug: e.target.value })}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Währung</Label>
                    <Input
                      className="h-11"
                      value={merged.currency}
                      disabled={!canManage}
                      onChange={(e) => patch({ currency: e.target.value })}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Sprache</Label>
                    <Input
                      className="h-11"
                      value={merged.locale}
                      disabled={!canManage}
                      onChange={(e) => patch({ locale: e.target.value })}
                    />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={merged.status}
                      disabled={!canManage}
                      onValueChange={(v) => patch({ status: v })}
                    >
                      <SelectTrigger className="h-11">
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
                  <Button
                    className="h-11"
                    onClick={() => saveMutation.mutate(merged)}
                    disabled={saveMutation.isPending}
                  >
                    Speichern
                  </Button>
                )}

                <Domains shopId={shop.id} orgId={orgId} canManage={!!canManage} />
              </div>
            </Panel>
          );
        })
      )}
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
    <div className="min-w-0 rounded-md border border-border p-4">
      <p className="text-sm font-medium">Domains</p>
      <div className="mt-3 min-w-0 space-y-2">
        {(domains.data ?? []).map((d) => (
          <div key={d.id} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">
            <span className="min-w-0 break-words">
              {d.domain} {d.is_primary && <span className="text-muted-foreground">· primär</span>}
            </span>
            {canManage && (
              <Button size="sm" variant="ghost" className="min-h-11 shrink-0" onClick={() => removeMutation.mutate(d.id)}>
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
        <div className="mt-3 flex min-w-0 flex-wrap gap-2">
          <Input
            className="h-11 min-w-0 flex-1"
            value={domain}
            placeholder="shop.beispiel.de"
            onChange={(e) => setDomain(e.target.value)}
          />
          <Button
            variant="outline"
            className="h-11"
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
