import * as vscode from "vscode";

export interface CodexConfig {
  useOss: boolean;
  model: string;
  reasoning:string,
  provider: string;
  approvalPolicy: string;
  sandboxMode: string;
  customArgs: string[];
  envVars: { [key: string]: string };
}

export const DEFAULT_CONFIG: CodexConfig = {
  useOss: false,
  model: "gpt-5",
  reasoning: "high",
  provider: "openai",
  approvalPolicy: "untrusted",
  sandboxMode: "workspace-write",
  customArgs: [],
  envVars: {},
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

    // Provider (only for non-OSS mode)
    if (this._config.provider && !this._config.useOss) {
      args.push("-c", `model_provider=${this._config.provider}`);
    }

    // Model specification
    if (this._config.model) {
      args.push("-c", `model="${this._config.model}"`);
    }

    if (this._config.reasoning) {
      args.push("-c", `model_reasoning_effort=${this._config.reasoning}`);
    }

    // Approval policy
    if (this._config.approvalPolicy) {
      console.log("Setting approvalPolicy to:", this._config.approvalPolicy);
      args.push("-c", `approval_policy=${this._config.approvalPolicy}`);
    }

    // Sandbox mode
    if (this._config.sandboxMode) {
      args.push("-c", `sandbox_mode=${this._config.sandboxMode}`);
    }

    args.push("-c", "show_raw_agent_reasoning=true");

    // Working directory
    if (workspacePath) {
      console.log("workspacePath", workspacePath);
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
      openai: ["gpt-5", "gpt-4o"],
      openrouter: ['openai/gpt-oss-20b:free', 'qwen/qwen3-coder:free', 'moonshotai/kimi-k2:free'],
      ollama: ["llama3.2", "gpt-oss:20b", "mistral", "gemma3", "qwen3"],
      anthropic: ["claude-4-sonnet", "claude-4-1-opus", "claude-4-opus"],
      google: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
      custom: [],
    };
  }

  public static getProviderOptions(): string[] {
    return ["ollama", "openai", "anthropic", "google", "openrouter", "custom"];
  }

  public static getApprovalPolicyOptions(): string[] {
    return ["never", "on-request", "on-failure", "untrusted"];
  }

  public static getSandboxModeOptions(): string[] {
    return ["read-only", "workspace-write", "danger-full-access"];
  }

  public static getProviderEnvVars(): { [provider: string]: string[] } {
    return {
      openai: ["OPENAI_API_KEY"],
      anthropic: ["ANTHROPIC_API_KEY"],
      openrouter: ["OPENROUTER_API_KEY"],
      google: ["GEMINI_API_KEY"],
      custom: [],
    };
  }

  public getEnvironmentVariables(): NodeJS.ProcessEnv {
    const env = { ...process.env };
    
    // Add configured environment variables
    if (this._config.envVars) {
      Object.keys(this._config.envVars).forEach(key => {
        const value = this._config.envVars[key];
        if (value && value.trim()) {
          env[key] = value;
        }
      });
    }
    
    return env;
  }
}
