/** Task inbox — the human side of the automation engine. */
import { getAdmin, writeAudit } from "../core.server";

export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";

export async function createTask(input: {
  organizationId: string;
  shopId: string | null;
  title: string;
  description?: string | null;
  priority?: TaskPriority;
  entityType?: string | null;
  entityId?: string | null;
  assignedTo?: string | null;
  dueAt?: string | null;
  source?: "manual" | "automation" | "system";
  executionId?: string | null;
  dedupeKey?: string | null;
  createdBy?: string | null;
}) {
  const admin = await getAdmin();
  if (input.dedupeKey) {
    const { data: existing } = await admin
      .from("tasks")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("dedupe_key", input.dedupeKey)
      .in("status", ["open", "in_progress"])
      .maybeSingle();
    if (existing) return { taskId: (existing as { id: string }).id, created: false };
  }
  const { data, error } = await admin
    .from("tasks")
    .insert({
      organization_id: input.organizationId,
      shop_id: input.shopId,
      title: input.title.slice(0, 200),
      description: input.description ?? null,
      priority: input.priority ?? "normal",
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      assigned_to: input.assignedTo ?? null,
      due_at: input.dueAt ?? null,
      source: input.source ?? "manual",
      source_automation_execution_id: input.executionId ?? null,
      dedupe_key: input.dedupeKey ?? null,
      created_by: input.createdBy ?? null,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { taskId: (data as { id: string }).id, created: true };
}

export type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  entityType: string | null;
  entityId: string | null;
  assignedTo: string | null;
  dueAt: string | null;
  source: string;
  createdAt: string;
  completedAt: string | null;
};

function mapTask(r: Record<string, unknown>): TaskRow {
  return {
    id: r["id"] as string,
    title: r["title"] as string,
    description: (r["description"] as string) ?? null,
    status: r["status"] as TaskStatus,
    priority: r["priority"] as TaskPriority,
    entityType: (r["entity_type"] as string) ?? null,
    entityId: (r["entity_id"] as string) ?? null,
    assignedTo: (r["assigned_to"] as string) ?? null,
    dueAt: (r["due_at"] as string) ?? null,
    source: r["source"] as string,
    createdAt: r["created_at"] as string,
    completedAt: (r["completed_at"] as string) ?? null,
  };
}

export async function listTasks(input: {
  organizationId: string;
  shopId?: string | null;
  status?: TaskStatus[] | null;
  assignedTo?: string | null;
  limit?: number;
}) {
  const admin = await getAdmin();
  let q = admin
    .from("tasks")
    .select("*")
    .eq("organization_id", input.organizationId)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 100);
  if (input.shopId) q = q.eq("shop_id", input.shopId);
  if (input.status?.length) q = q.in("status", input.status);
  if (input.assignedTo) q = q.eq("assigned_to", input.assignedTo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapTask(r as Record<string, unknown>));
}

export async function updateTaskStatus(input: {
  organizationId: string;
  taskId: string;
  status: TaskStatus;
  actorId: string;
}) {
  const admin = await getAdmin();
  const done = input.status === "completed" || input.status === "cancelled";
  const { error } = await admin
    .from("tasks")
    .update({
      status: input.status,
      completed_at: done ? new Date().toISOString() : null,
      completed_by: done ? input.actorId : null,
    } as never)
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: `task.${input.status}`,
    entityType: "task",
    entityId: input.taskId,
  });
  return { ok: true };
}

export async function assignTask(input: {
  organizationId: string;
  taskId: string;
  assignedTo: string | null;
  actorId: string;
}) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("tasks")
    .update({ assigned_to: input.assignedTo } as never)
    .eq("id", input.taskId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  return { ok: true };
}
