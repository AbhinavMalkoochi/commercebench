import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { BudgetLedger, BudgetLedgerEntry } from "@/agent/core/types";

export class FileBudgetLedger implements BudgetLedger {
  constructor(private readonly filePath: string) {}

  async listEntries(): Promise<BudgetLedgerEntry[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      return JSON.parse(contents) as BudgetLedgerEntry[];
    } catch {
      return [];
    }
  }

  async appendEntry(entry: BudgetLedgerEntry): Promise<void> {
    const entries = await this.listEntries();
    entries.push(entry);

    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(entries, null, 2));
  }
}