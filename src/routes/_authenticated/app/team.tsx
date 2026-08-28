import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  listTeam,
  createInvitation,
  revokeInvitation,
  updateMemberRole,
  removeMember,
} from "@/lib/commerce/team.functions";
import type { Role } from "@/lib/commerce/workspace.functions";
import { getWorkspace } from "@/lib/commerce/workspace.functions";
import { useWorkspaceStore } from "@/lib/commerce/useWorkspaceStore";
import { ASSIGNABLE_ROLES, roleLabel } from "@/lib/commerce/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/shell/PageHeader";
import { Panel } from "@/components/shell/DetailLayout";
import { EmptyState, ListSkeleton } from "@/components/data/States";

export const Route = createFileRoute("/_authenticated/app/team")({
  head: () => ({
    meta: [
      { title: "Team & Einladungen – EYIS" },
      {
        name: "description",
        content: "Mitglieder verwalten, Rollen vergeben und Einladungen per Token versenden.",
      },
      { property: "og:title", content: "Team & Einladungen – EYIS" },
      {
        property: "og:description",
        content: "Mitglieder verwalten, Rollen vergeben und Einladungen per Token versenden.",
      },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { orgId } = useWorkspaceStore();
  const qc = useQueryClient();
  const fetchTeam = useServerFn(listTeam);
  const fetchWorkspace = useServerFn(getWorkspace);
  const invite = useServerFn(createInvitation);
  const revoke = useServerFn(revokeInvitation);
  const changeRole = useServerFn(updateMemberRole);
  const kick = useServerFn(removeMember);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("read_only");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const workspace = useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
  const canManage = workspace.data?.organizations
    .find((o) => o.id === orgId)
    ?.permissions.includes("settings.manage");

  const team = useQuery({
    queryKey: ["team", orgId],
    queryFn: () => fetchTeam({ data: { organizationId: orgId } }),
    enabled: !!orgId,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["team", orgId] });
  const fail = (e: Error) => toast.error(e.message);

  const inviteMutation = useMutation({
    mutationFn: () => invite({ data: { organizationId: orgId, email, role } }),
    onSuccess: (res) => {
      setInviteLink(`${window.location.origin}/invite?token=${res.token}`);
      setEmail("");
      toast.success("Einladung erstellt – Link einmalig kopieren.");
      refresh();
    },
    onError: fail,
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => revoke({ data: { organizationId: orgId, invitationId } }),
    onSuccess: () => {
      toast.success("Einladung widerrufen.");
      refresh();
    },
    onError: fail,
  });

  const roleMutation = useMutation({
    mutationFn: (v: { membershipId: string; role: Role }) =>
      changeRole({ data: { organizationId: orgId, ...v } }),
    onSuccess: () => {
      toast.success("Rolle aktualisiert.");
      refresh();
    },
    onError: fail,
  });

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => kick({ data: { organizationId: orgId, membershipId } }),
    onSuccess: () => {
      toast.success("Mitglied entfernt.");
      refresh();
    },
    onError: fail,
  });

  if (team.isLoading) return <ListSkeleton />;

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        title="Team"
        description="Mitgliedschaften entstehen ausschließlich durch angenommene Token-Einladungen."
      />

      {canManage && (
        <Panel title="Person einladen">
          <div className="min-w-0 space-y-4">
            <div className="grid min-w-0 gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="invite-email">E-Mail</Label>
                <Input
                  id="invite-email"
                  type="email"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="person@firma.de"
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label>Rolle</Label>
                <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                  <SelectTrigger aria-label="Rolle der Einladung" className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="h-11"
                onClick={() => inviteMutation.mutate()}
                disabled={!email || inviteMutation.isPending}
              >
                Einladen
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Gültig für 7 Tage. Eine erneute Einladung derselben Adresse widerruft die vorherige.
            </p>
            {inviteLink && (
              <div className="min-w-0 rounded-md border border-accent bg-accent/20 p-3">
                <p className="text-xs font-medium">Einladungslink (wird nur einmal angezeigt)</p>
                <code className="mt-1 block min-w-0 break-all text-xs">{inviteLink}</code>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 min-h-11"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteLink);
                    toast.success("Link kopiert.");
                  }}
                >
                  Kopieren
                </Button>
              </div>
            )}
          </div>
        </Panel>
      )}

      <Panel title="Mitglieder">
        {!team.data?.members.length ? (
          <EmptyState title="Keine Mitglieder" description="Es sind noch keine Mitglieder in dieser Organisation." />
        ) : (
          <div className="min-w-0 space-y-3">
            {team.data?.members.map((m) => (
              <div
                key={m.id}
                className="grid min-w-0 grid-cols-1 items-center gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="min-w-0 truncate font-medium">{m.full_name || m.email || "Unbekannt"}</p>
                  <p className="min-w-0 break-words text-xs text-muted-foreground">{m.email}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {canManage && m.role !== "owner" ? (
                    <Select
                      value={m.role}
                      onValueChange={(v) =>
                        roleMutation.mutate({ membershipId: m.id, role: v as Role })
                      }
                    >
                      <SelectTrigger aria-label="Rolle des Mitglieds" className="h-11 w-44">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNABLE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {roleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge>{roleLabel(m.role)}</Badge>
                  )}
                  {canManage && m.role !== "owner" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeMutation.mutate(m.id)}
                      className="min-h-11 text-destructive"
                    >
                      Entfernen
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Einladungen">
        {team.data?.invitations.length === 0 ? (
          <EmptyState title="Keine Einladungen" description="Es sind aktuell keine Einladungen offen." />
        ) : (
          <div className="min-w-0 space-y-3">
            {team.data?.invitations.map((i) => (
              <div
                key={i.id}
                className="grid min-w-0 grid-cols-1 items-center gap-3 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,1fr)_auto]"
              >
                <div className="min-w-0">
                  <p className="min-w-0 break-words font-medium">{i.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {roleLabel(i.role)} · läuft ab am{" "}
                    {new Date(i.expires_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={i.status === "pending" ? "default" : "secondary"}>
                    {
                      {
                        pending: "offen",
                        accepted: "angenommen",
                        revoked: "widerrufen",
                        expired: "abgelaufen",
                      }[i.status]
                    }
                  </Badge>
                  {canManage && i.status === "pending" && (
                    <Button size="sm" variant="ghost" className="min-h-11" onClick={() => revokeMutation.mutate(i.id)}>
                      Widerrufen
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
