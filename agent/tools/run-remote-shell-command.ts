import { execFile } from "node:child_process";
import { promisify } from "node:util";

import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  RunRemoteShellCommandInput,
  RunRemoteShellCommandOutput,
} from "@/agent/core/tools";

const execFileAsync = promisify(execFile);

function quoteShellSegment(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildShellCommand(command: string, workingDirectory?: string): string {
  if (!workingDirectory) {
    return command;
  }

  return `cd ${quoteShellSegment(workingDirectory)} && ${command}`;
}

export async function executeRemoteShellCommand(
  input: RunRemoteShellCommandInput,
  now: Date,
): Promise<RunRemoteShellCommandOutput> {
  const started = Date.now();
  const mode = input.mode ?? (process.env.AGENT_REMOTE_SHELL_MODE === "local" ? "local" : "ssh");
  const timeoutMs = Math.max(1, input.timeoutSeconds ?? 30) * 1000;
  const preparedCommand = buildShellCommand(input.command, input.workingDirectory);

  if (mode === "local") {
    const localShell = process.env.AGENT_REMOTE_LOCAL_SHELL ?? "/bin/sh";
    const { stdout, stderr } = await execFileAsync(localShell, ["-c", preparedCommand], {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
    });

    return {
      executedAt: now.toISOString(),
      mode,
      host: "local",
      command: input.command,
      exitCode: 0,
      stdout,
      stderr,
      durationMs: Date.now() - started,
    };
  }

  const host = input.host ?? process.env.AGENT_REMOTE_SHELL_HOST;
  const user = input.user ?? process.env.AGENT_REMOTE_SHELL_USER;
  const port = input.port ?? Number(process.env.AGENT_REMOTE_SSH_PORT ?? "22");
  const identityFile = input.identityFile ?? process.env.AGENT_REMOTE_SSH_IDENTITY_FILE;
  const sshBinary = process.env.AGENT_REMOTE_SSH_BINARY ?? "ssh";

  if (!host || !user) {
    throw new Error("Remote shell requires AGENT_REMOTE_SHELL_HOST and AGENT_REMOTE_SHELL_USER or explicit host/user input.");
  }

  const sshArgs = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-p", String(port)];

  if (identityFile) {
    sshArgs.push("-i", identityFile);
  }

  sshArgs.push(`${user}@${host}`, preparedCommand);

  const { stdout, stderr } = await execFileAsync(sshBinary, sshArgs, {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });

  return {
    executedAt: now.toISOString(),
    mode,
    host: `${user}@${host}:${port}`,
    command: input.command,
    exitCode: 0,
    stdout,
    stderr,
    durationMs: Date.now() - started,
  };
}

export async function run_remote_shell_command(
  input: RunRemoteShellCommandInput,
  context: AgentToolExecutionContext,
): Promise<RunRemoteShellCommandOutput> {
  return executeRemoteShellCommand(input, context.now);
}

export const runRemoteShellCommandTool: AgentToolDefinition<
  "run_remote_shell_command",
  RunRemoteShellCommandInput,
  RunRemoteShellCommandOutput
> = {
  name: "run_remote_shell_command",
  description: "Run a guarded shell command on the configured hosted agent server over SSH.",
  stage: "monitoring",
  risk: "high",
  requiresApproval: true,
  execute: run_remote_shell_command,
};