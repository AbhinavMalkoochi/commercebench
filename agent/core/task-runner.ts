import {
  AgentTaskPlan,
  AgentTaskRunResult,
  AgentToolExecutionContext,
  AgentToolPolicy,
  AgentToolPolicyContext,
  AgentToolRegistry,
} from "@/agent/core/tools";
import { ToolExecutor } from "@/agent/core/tool-executor";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

export class AgentTaskRunner {
  private readonly executor: ToolExecutor;

  constructor(
    registry: AgentToolRegistry,
    private readonly policy: AgentToolPolicy,
    private readonly trace?: FileResearchTrace,
  ) {
    this.executor = new ToolExecutor(registry, trace);
  }

  async runPlan(
    plan: AgentTaskPlan,
    toolContext: AgentToolExecutionContext,
    policyContext: AgentToolPolicyContext,
  ): Promise<AgentTaskRunResult> {
    const completedSteps: AgentTaskRunResult["completedSteps"] = [];

    await Promise.all([
      this.trace?.writeJson("runtime/task-plan.json", plan),
      this.trace?.recordEvent("task_plan_started", {
        objective: plan.objective,
        stage: policyContext.stage,
        stepCount: plan.steps.length,
      }),
    ]);

    for (const step of plan.steps) {
      const decision = this.policy.evaluate(this.executor.getToolDefinition(step.toolName), policyContext);

      if (!decision.allowed) {
        const blockedResult: AgentTaskRunResult = {
          status: "blocked",
          objective: plan.objective,
          completedSteps,
          blockedStepId: step.id,
          blockedReason: decision.reason,
        };

        await Promise.all([
          this.trace?.writeJson("runtime/task-result.json", blockedResult),
          this.trace?.recordEvent("task_plan_blocked", {
            objective: plan.objective,
            blockedStepId: step.id,
            reason: decision.reason,
          }),
        ]);

        return blockedResult;
      }

      const output = await this.executor.execute(step.toolName, step.input as never, toolContext);
      completedSteps.push({
        stepId: step.id,
        toolName: step.toolName,
        output,
      });
    }

    const result: AgentTaskRunResult = {
      status: "completed",
      objective: plan.objective,
      completedSteps,
    };

    await Promise.all([
      this.trace?.writeJson("runtime/task-result.json", result),
      this.trace?.recordEvent("task_plan_completed", {
        objective: plan.objective,
        completedStepCount: completedSteps.length,
      }),
    ]);

    return result;
  }
}