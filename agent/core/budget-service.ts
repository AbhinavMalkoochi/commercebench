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
    const grouped = new Map<string, typeof entries>();

    for (const entry of entries) {
      const key = entry.referenceId ?? entry.id;
      const existing = grouped.get(key) ?? [];
      existing.push(entry);
      grouped.set(key, existing);
    }

    return [...grouped.values()].reduce((sum, group) => {
      const executed = [...group].reverse().find((entry) => entry.status === "executed");

      if (executed) {
        return sum + executed.amountUsd;
      }

      const planned = [...group].reverse().find((entry) => entry.status === "planned");
      return planned ? sum + planned.amountUsd : sum;
    }, 0);
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

  async recordPlannedAction(action: string, amountUsd: number, referenceId: string): Promise<BudgetCheckResult> {
    const check = await this.checkBudget(amountUsd);

    await this.ledger.appendEntry({
      id: `${referenceId}-planned`,
      action,
      amountUsd,
      status: check.allowed ? "planned" : "blocked",
      recordedAt: new Date().toISOString(),
      referenceId,
    });

    return check;
  }

  async recordExecutedAction(action: string, amountUsd: number, referenceId: string): Promise<void> {
    await this.ledger.appendEntry({
      id: `${referenceId}-executed`,
      action,
      amountUsd,
      status: "executed",
      recordedAt: new Date().toISOString(),
      referenceId,
    });
  }
}