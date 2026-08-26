/** Client-safe types for the system monitoring surfaces (Phase 14 / Gate A8). */

export type JobRow = {
  id: string;
  jobType: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  availableAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  lastError: string | null;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ExecutionRow = {
  id: string;
  ruleId: string | null;
  triggerType: string;
  status: string;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
};

export type JobsOverview = {
  generatedAt: string;
  jobsByStatus: Record<string, number>;
  duePending: number;
  stuckRunning: number;
  recentJobs: JobRow[];
  recentExecutions: ExecutionRow[];
  outboxByStatus: Record<string, number>;
  outboxOldestPendingAt: string | null;
  communicationsByStatus: Record<string, number>;
};

export type ProviderStatus = {
  area: "payments" | "shipping" | "communications";
  provider: string;
  displayName: string | null;
  environment: string | null;
  status: string;
};

export type SystemStatus = {
  generatedAt: string;
  dbLatencyMs: number;
  counts: { products: number; orders: number; customers: number; openTasks: number };
  providers: ProviderStatus[];
  cronEndpoints: { path: string; schedule: string; purpose: string }[];
};

export type SystemError = {
  source: "automation_job" | "automation_execution" | "communication" | "payment" | "store_api" | "outbox";
  at: string;
  code: string | null;
  message: string;
  entityId: string | null;
};

export const CRON_ENDPOINTS: { path: string; schedule: string; purpose: string }[] = [
  {
    path: "/api/public/jobs/automation",
    schedule: "*/1 min",
    purpose: "Automation-Worker: Jobs claimen, Schedules einreihen, hängengebliebene Jobs freigeben",
  },
  {
    path: "/api/public/jobs/communications",
    schedule: "*/1 min",
    purpose: "Kommunikations-Queue: fällige und wiederholbare Nachrichten senden",
  },
  {
    path: "/api/public/jobs/expiration",
    schedule: "*/5 min",
    purpose: "Ablauf: Checkout-Sessions, Inventory-Reservierungen und Warenkörbe expiren lassen",
  },
];
