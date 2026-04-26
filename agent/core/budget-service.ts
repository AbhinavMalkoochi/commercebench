import { BudgetCheckResult, BudgetLedger } from "@/agent/core/types";

export class BudgetService {
  constructor(
    private readonly ledger: BudgetLedger,
    private readonly config: {
      totalBudgetUsd: number;
      reserveUsd: number;
    },
  ) {}

  async getCommittedSpendUsd(): Promise<number> {
    const entries = await this.ledger.listEntries();
    return entries
      .filter((entry) => entry.status === "planned" || entry.status === "executed")
      .reduce((sum, entry) => sum + entry.amountUsd, 0);
  }

  async checkBudget(amountUsd: number): Promise<BudgetCheckResult> {
    const committedSpendUsd = await this.getCommittedSpendUsd();
    const remainingBudgetUsd = Number((this.config.totalBudgetUsd - committedSpendUsd).toFixed(2));
    const remainingAfterActionUsd = Number((remainingBudgetUsd - amountUsd).toFixed(2));

    return {
      allowed: remainingAfterActionUsd >= this.config.reserveUsd,
      remainingBudgetUsd,
      remainingAfterActionUsd,
      reserveUsd: this.config.reserveUsd,
    };
  }

  async recordPlannedAction(action: string, amountUsd: number): Promise<BudgetCheckResult> {
    const check = await this.checkBudget(amountUsd);

    await this.ledger.appendEntry({
      action,
      amountUsd,
      status: check.allowed ? "planned" : "blocked",
      recordedAt: new Date().toISOString(),
    });

    return check;
  }

  async recordExecutedAction(action: string, amountUsd: number): Promise<void> {
    await this.ledger.appendEntry({
      action,
      amountUsd,
      status: "executed",
      recordedAt: new Date().toISOString(),
    });
  }
}