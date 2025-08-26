import { spawn } from "child_process";

export async function isCodexAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const childProcess = spawn("codex", ["-h"], { shell: true });

      childProcess.on("close", (code: number | null) => {
        resolve(code === 0);
      });

      childProcess.on("error", () => {
        resolve(false);
      });
    } catch {
      resolve(false);
    }
  });
}

export async function getCodexVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const childProcess = spawn("codex", ["-V"], { shell: true });

      let stdout = "";

      childProcess.stdout?.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      childProcess.on("close", (code: number | null) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error("Failed to get codex version"));
        }
      });

      childProcess.on("error", (error: Error) => {
        reject(new Error(`Failed to get codex version: ${error.message}`));
      });
    } catch (error) {
      reject(
        new Error(
          `Failed to execute codex version command: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    }
  });
}
