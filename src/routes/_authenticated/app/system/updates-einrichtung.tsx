import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  acknowledgePublishStepFn,
  getUpdateSetupFn,
  runUpdateSetupFn,
} from "@/lib/commerce/updates/updates.functions";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ErrorState, ListSkeleton, PermissionState } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/system/updates-einrichtung")({
  head: () => ({
    meta: [
      { title: "Update-Einrichtung – EYIS" },
      {
        name: "description",
        content:
          "Die fünf Update-Nachweise dieser Installation automatisch erkennen, hinterlegen und belegen.",
      },
    ],
  }),
  component: UpdateSetupPage,
});

function StepRow({
  title,
  status,
  detail,
  remediation,
}: {
  title: string;
  status: string;
  detail: string;
  remediation?: string | undefined;
}) {
  const ready = status === "SUPPORTED";
  return (
    <div className="border-b py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <span className="flex items-center gap-2 text-sm font-medium">
          {ready ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
          ) : (
            <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}
          {title}
        </span>
        <Badge variant={ready ? "outline" : "secondary"}>
          {ready ? "Bereit" : "Wird eingerichtet"}
        </Badge>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      {!ready && remediation && (
        <p className="mt-1 break-words text-xs text-muted-foreground">{remediation}</p>
      )}
    </div>
  );
}

function UpdateSetupPage() {
  const { organizationId, isLoading: workspaceLoading } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const loadSetup = useServerFn(getUpdateSetupFn);
  const runSetup = useServerFn(runUpdateSetupFn);
  const acknowledge = useServerFn(acknowledgePublishStepFn);
  const [repo, setRepo] = useState("");
  const [publishAck, setPublishAck] = useState(false);

  const setup = useQuery({
    queryKey: ["update-setup", organizationId],
    enabled: Boolean(organizationId),
    queryFn: () => loadSetup({ data: { organizationId: organizationId as string } }),
  });

  const start = useMutation({
    mutationFn: () =>
      runSetup({
        data: {
          organizationId: organizationId as string,
          ...(repo ? { repo } : {}),
          acknowledgePublish: publishAck,
        },
      }),
    onSuccess: (result) => {
      queryClient.setQueryData(["update-setup", organizationId], result.state);
      void queryClient.invalidateQueries({ queryKey: ["update-overview"] });
      const failed = result.actions.filter((a) => a.status === "failed");
      if (failed.length === 0) toast.success("Einrichtung abgeschlossen.");
      else toast.error(failed[0]?.detail ?? "Einrichtung teilweise fehlgeschlagen.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const togglePublish = useMutation({
    mutationFn: (value: boolean) =>
      acknowledge({ data: { organizationId: organizationId as string, acknowledged: value } }),
    onSuccess: (state) => queryClient.setQueryData(["update-setup", organizationId], state),
    onError: (error: Error) => toast.error(error.message),
  });

  if (workspaceLoading || setup.isLoading) return <ListSkeleton />;
  if (!organizationId) return <PermissionState />;
  if (setup.error) return <ErrorState />;

  const state = setup.data;
  if (!state) return <ErrorState />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Einrichtung für Updates"
        description="EYIS erkennt die nötigen Verbindungen selbst, hinterlegt sie und weist sie nach."
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/system/updates">
              <ArrowLeft className="mr-2 size-4" aria-hidden />
              Zum Update Center
            </Link>
          </Button>
        }
      />

      <Panel title="Nachweise" description="Stand nach der letzten Prüfung.">
        <div className="mb-4 flex items-center gap-2 text-sm">
          <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
          <span>
            {state.ready
              ? "Alle fünf Nachweise sind erfüllt."
              : `${state.steps.filter((s) => s.status === "SUPPORTED").length} von 5 Nachweisen erfüllt.`}
          </span>
        </div>
        {state.steps.map((step) => (
          <StepRow
            key={step.id}
            title={step.title}
            status={step.status}
            detail={step.detail}
            remediation={step.remediation}
          />
        ))}
      </Panel>

      <Panel
        title="Einrichtung starten"
        description="EYIS legt Workflow und Zugänge im Repository dieser Installation an."
      >
        <div className="space-y-4">
          {!state.repo && state.repoCandidates.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="repo">Repository dieser Installation</Label>
              <Select value={repo} onValueChange={setRepo}>
                <SelectTrigger id="repo">
                  <SelectValue placeholder="Repository auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {state.repoCandidates.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {candidate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {state.repo && (
            <p className="text-sm text-muted-foreground">
              Repository: <span className="font-medium text-foreground">{state.repo}</span>
            </p>
          )}

          <div className="flex items-start gap-3">
            <Checkbox
              id="publish-ack"
              checked={publishAck || Boolean(state.publishAcknowledgedAt)}
              onCheckedChange={(value) => {
                const next = value === true;
                setPublishAck(next);
                if (state.publishAcknowledgedAt && !next) togglePublish.mutate(false);
              }}
            />
            <Label htmlFor="publish-ack" className="text-sm font-normal leading-relaxed">
              Ich löse die Veröffentlichung nach jedem Update selbst aus (Publish → Update). Lovable
              veröffentlicht neue Stände nicht automatisch.
            </Label>
          </div>

          <p className="text-sm text-muted-foreground">
            Datenbank-Zugang:{" "}
            {state.databaseSecrets.availableFromInstallation
              ? "liegt in der Installation vor und wird verschlüsselt ins Repository übertragen."
              : "in dieser Installation nicht hinterlegt — schemaändernde Updates bleiben so lange gesperrt."}
          </p>

          <Button
            onClick={() => start.mutate()}
            disabled={start.isPending || (!state.repo && !repo)}
          >
            {start.isPending && <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />}
            Einrichtung starten
          </Button>

          {start.data && (
            <ul className="space-y-1 text-sm">
              {start.data.actions.map((action) => (
                <li key={action.action} className="flex flex-wrap gap-2">
                  <span className="font-medium">{action.action}:</span>
                  <span className="text-muted-foreground">{action.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
