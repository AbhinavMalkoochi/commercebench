import {
  AgentToolExecutionContext,
  AgentToolMap,
  AgentToolName,
  AgentToolRegistry,
} from "@/agent/core/tools";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

export class ToolExecutor {
  constructor(
    private readonly registry: AgentToolRegistry,
    private readonly trace?: FileResearchTrace,
  ) {}

  async execute<Name extends AgentToolName>(
    name: Name,
    input: AgentToolMap[Name]["input"],
    context: AgentToolExecutionContext,
  ): Promise<AgentToolMap[Name]["output"]> {
    const tool = this.registry.getTool(name);
    const toolCallId = `${name}-${context.now.toISOString()}`;
    const baseName = this.trace?.queryBaseName(toolCallId);

    await Promise.all([
      this.trace?.writeJson(`tools/${baseName}-input.json`, {
        tool: name,
        stage: tool.stage,
        risk: tool.risk,
        requiresApproval: tool.requiresApproval,
        input,
      }),
      this.trace?.recordEvent("tool_execution_started", {
        tool: name,
        stage: tool.stage,
        risk: tool.risk,
      }),
    ]);

    try {
      const output = await tool.execute(input, context);

      await Promise.all([
        this.trace?.writeJson(`tools/${baseName}-output.json`, output),
        this.trace?.recordEvent("tool_execution_completed", {
          tool: name,
          stage: tool.stage,
        }),
      ]);

      return output;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown tool execution error";

      await Promise.all([
        this.trace?.writeJson(`tools/${baseName}-error.json`, {
          tool: name,
          message,
        }),
        this.trace?.recordEvent("tool_execution_failed", {
          tool: name,
          message,
        }),
      ]);

      throw error;
    }
  }
}