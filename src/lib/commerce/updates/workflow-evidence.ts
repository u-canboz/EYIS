export type WorkflowJob = { name: string; status: string; conclusion: string | null };

/** A successful workflow with missing/skipped jobs is not an update proof. */
export function missingWorkflowEvidence(jobs: WorkflowJob[], schemaChanging: boolean): string[] {
  const required = schemaChanging ? ["code", "database", "deploy"] : ["code", "deploy"];
  return required.filter(
    (name) =>
      !jobs.some((j) => j.name === name && j.status === "completed" && j.conclusion === "success"),
  );
}
