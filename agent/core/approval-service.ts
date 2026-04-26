import { randomUUID } from "node:crypto";

import { ApprovalRequest, ApprovalStore } from "@/agent/core/types";

export class ApprovalService<Action extends string = string> {
  constructor(private readonly store: ApprovalStore) {}

  async requestApproval(action: Action, metadata?: Record<string, unknown>): Promise<ApprovalRequest> {
    const request: ApprovalRequest = {
      id: randomUUID(),
      action,
      status: "pending",
      requestedAt: new Date().toISOString(),
      metadata,
    };

    await this.store.upsertRequest(request);
    return request;
  }

  async decideRequest(id: string, status: "approved" | "rejected"): Promise<ApprovalRequest> {
    const existing = (await this.store.listRequests()).find((request) => request.id === id);

    if (!existing) {
      throw new Error(`Approval request ${id} was not found.`);
    }

    const updated: ApprovalRequest = {
      ...existing,
      status,
      decidedAt: new Date().toISOString(),
    };

    await this.store.upsertRequest(updated);
    return updated;
  }

  async listApprovedActions(): Promise<Action[]> {
    const requests = await this.store.listRequests();
    return requests
      .filter((request) => request.status === "approved")
      .map((request) => request.action as Action);
  }
}