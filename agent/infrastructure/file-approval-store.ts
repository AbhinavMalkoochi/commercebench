import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ApprovalRequest, ApprovalStore } from "@/agent/core/types";

export class FileApprovalStore implements ApprovalStore {
  constructor(private readonly filePath: string) {}

  async listRequests(): Promise<ApprovalRequest[]> {
    try {
      const contents = await readFile(this.filePath, "utf8");
      return JSON.parse(contents) as ApprovalRequest[];
    } catch {
      return [];
    }
  }

  async upsertRequest(request: ApprovalRequest): Promise<void> {
    const requests = await this.listRequests();
    const next = requests.filter((entry) => entry.id !== request.id);
    next.push(request);

    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(next, null, 2));
  }
}