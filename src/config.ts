import * as vscode from "vscode";

export interface CodexConfig {
  useOss: boolean;
  model: string;
  provider: string;
  approvalPolicy: string;
  sandboxMode: string;
  customArgs: string[];
}

export const DEFAULT_CONFIG: CodexConfig = {
  useOss: true,
  model: "llama3.2",
  provider: "ollama",
  approvalPolicy: "on-request",
  sandboxMode: "workspace-write",
  customArgs: [],
};

export class ConfigManager {
  private _context: vscode.ExtensionContext;
  private _config: CodexConfig;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._config = this._loadConfig();
  }

  private _loadConfig(): CodexConfig {
    const saved = this._context.globalState.get<CodexConfig>("codexia.config");
    return { ...DEFAULT_CONFIG, ...saved };
  }

  public async saveConfig(config: Partial<CodexConfig>): Promise<void> {
    this._config = { ...this._config, ...config };
    await this._context.globalState.update("codexia.config", this._config);
  }

  public getConfig(): CodexConfig {
    return { ...this._config };
  }

  public getCodexArgs(workspacePath?: string): string[] {
    const args: string[] = [];

    // OSS mode configuration
    if (this._config.useOss) {
      args.push("--oss");
      // Explicitly set OSS provider
      args.push("-c", "model_provider=oss");
    }

    // Model specification
    if (this._config.model) {
      args.push("-c", `model=${this._config.model}`);
    }

    // Provider (only for non-OSS mode)
    if (this._config.provider && !this._config.useOss) {
      args.push("-c", `model_provider=${this._config.provider}`);
    }

    // Approval policy
    if (this._config.approvalPolicy) {
      console.log("approvalPolicy", this._config.approvalPolicy)
      args.push("-a", this._config.approvalPolicy);
    }

    // Sandbox mode
    if (this._config.sandboxMode) {
      args.push("-c", `sandbox_mode=${this._config.sandboxMode}`);
    }

    args.push("-c", "show_raw_agent_reasoning=true");

    // Working directory
    if (workspacePath) {
      console.log("workspacePath", workspacePath)
      args.push("-c", `cwd=${workspacePath}`);
    }

    // Add custom arguments
    if (this._config.customArgs && this._config.customArgs.length > 0) {
      args.push(...this._config.customArgs);
    }

    return args;
  }

  // Predefined model options
  public static getModelOptions(): { [provider: string]: string[] } {
    return {
      ollama: ["llama3.2", "gpt-oss:20b", "mistral", "gemma3"],
      openai: ["gpt-5", "gpt-4o"],
      anthropic: ["claude-4-sonnet", "claude-4-1-opus", "claude-4-opus"],
      gemini: ["gemini-2.5-pro", "gemini-2.5-flash"],
      custom: [],
    };
  }

  public static getProviderOptions(): string[] {
    return ["ollama", "openai", "anthropic", "gemini", "custom"];
  }

  public static getApprovalPolicyOptions(): string[] {
    return ["never", "on-request", "on-failure", "untrusted"];
  }

  public static getSandboxModeOptions(): string[] {
    return ["read-only", "workspace-write", "danger-full-access"];
  }
}
