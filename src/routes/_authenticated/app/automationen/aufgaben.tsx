import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import {
  listTasksFn,
  createTaskFn,
  updateTaskStatusFn,
} from "@/lib/commerce/automation/automation.functions";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskStatus,
} from "@/lib/commerce/automation/automation.types";
import { useActiveWorkspace } from "@/lib/commerce/useActiveWorkspace";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/eyis/shell/PageHeader";
import { DetailLayout, Panel } from "@/eyis/shell/DetailLayout";
import { EmptyState } from "@/eyis/data/States";

export const Route = createFileRoute("/_authenticated/app/automationen/aufgaben")({
  head: () => ({
    meta: [
      { title: "Aufgaben – EYIS" },
      {
        name: "description",
        content:
          "Operative Inbox: Aufgaben aus Automationen und manuelle To-dos für das Team an einer Stelle abarbeiten.",
      },
      { property: "og:title", content: "Aufgaben – EYIS" },
      {
        property: "og:description",
        content: "Alles, was menschliche Entscheidung braucht, in einer Liste.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TaskInbox,
});

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-destructive/15 text-destructive",
  high: "bg-amber-500/15 text-amber-700",
  normal: "bg-muted text-muted-foreground",
  low: "bg-muted text-muted-foreground",
};

function TaskInbox() {
  const { organizationId, shopId } = useActiveWorkspace();
  const qc = useQueryClient();
  const enabled = !!organizationId && !!shopId;

  const [filter, setFilter] = useState<"open" | "all">("open");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");

  const fetchTasks = useServerFn(listTasksFn);
  const createTask = useServerFn(createTaskFn);
  const updateStatus = useServerFn(updateTaskStatusFn);

  const tasks = useQuery({
    queryKey: ["tasks", organizationId, shopId, filter],
    enabled,
    queryFn: () =>
      fetchTasks({
        data: {
          organizationId,
          shopId,
          status: filter === "open" ? (["open", "in_progress"] as TaskStatus[]) : null,
        },
      }),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks"] });
    void qc.invalidateQueries({ queryKey: ["automation-inbox"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      createTask({
        data: { organizationId, shopId, title, description: description || null, priority },
      }),
    onSuccess: () => {
      toast.success("Aufgabe angelegt.");
      setTitle("");
      setDescription("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: (v: { taskId: string; status: TaskStatus }) =>
      updateStatus({ data: { organizationId, ...v } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={
          <Link
            to="/app/automationen"
            className="inline-flex min-h-11 items-center gap-1.5 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 shrink-0" aria-hidden />
            Automationen
          </Link>
        }
        title="Aufgaben"
        description="Was Automationen nicht allein entscheiden können, landet hier."
        actions={
          <>
            <Button
              className="h-11"
              variant={filter === "open" ? "default" : "outline"}
              onClick={() => setFilter("open")}
            >
              Offen
            </Button>
            <Button
              className="h-11"
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
            >
              Alle
            </Button>
          </>
        }
      />

      <DetailLayout
        main={
          <Panel title="Aufgabenliste">
            {tasks.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (tasks.data ?? []).length === 0 ? (
              <EmptyState title="Keine offenen Aufgaben" description="Gut gemacht." />
            ) : (
              <ul className="min-w-0 divide-y divide-border">
                {(tasks.data ?? []).map((t) => (
                  <li
                    key={t.id}
                    className="grid min-w-0 grid-cols-1 gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <p className="min-w-0 break-words font-medium">{t.title}</p>
                        <Badge variant="secondary" className={PRIORITY_TONE[t.priority] ?? ""}>
                          {TASK_PRIORITY_LABELS[t.priority as keyof typeof TASK_PRIORITY_LABELS] ??
                            t.priority}
                        </Badge>
                        {t.source === "automation" && <Badge variant="outline">Automation</Badge>}
                      </div>
                      {t.description && (
                        <p className="mt-1 min-w-0 break-words text-sm text-muted-foreground">
                          {t.description}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ??
                          t.status}
                        {t.dueAt ? ` · fällig ${new Date(t.dueAt).toLocaleString("de-DE")}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {t.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            statusMutation.mutate({ taskId: t.id, status: "in_progress" })
                          }
                        >
                          Übernehmen
                        </Button>
                      )}
                      {t.status !== "completed" && t.status !== "cancelled" && (
                        <Button
                          size="sm"
                          onClick={() =>
                            statusMutation.mutate({ taskId: t.id, status: "completed" })
                          }
                        >
                          Erledigt
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        }
        aside={
          <Panel title="Neue Aufgabe" bodyClassName="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="task-title">Titel</Label>
              <Input
                id="task-title"
                className="h-11"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-desc">Beschreibung</Label>
              <Textarea
                id="task-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Priorität</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
                <SelectTrigger className="h-11 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="urgent">Dringend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              className="h-11 w-full"
              disabled={!title.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              Aufgabe anlegen
            </Button>
          </Panel>
        }
      />
    </div>
  );
}
