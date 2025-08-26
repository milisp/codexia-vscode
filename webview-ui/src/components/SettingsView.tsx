import React, { useState, useEffect } from 'react';
import { postMessage, setupMessageListener } from '../utils/vscode-api';

interface SettingsViewProps {
  onDone: () => void;
}

interface CodexConfig {
  useOss: boolean;
  model: string;
  reasoning: string;
  provider: string;
  approvalPolicy: string;
  sandboxMode: string;
  customArgs: string[];
  envVars: { [key: string]: string };
}

interface SettingsData {
  config: CodexConfig;
  modelOptions: { [provider: string]: string[] };
  providers: string[];
  approvalPolicies: string[];
  sandboxModes: string[];
  providerEnvVars: { [provider: string]: string[] };
}

const SettingsView: React.FC<SettingsViewProps> = ({ onDone }) => {
  const [settingsData, setSettingsData] = useState<SettingsData | null>(null);
  const [config, setConfig] = useState<CodexConfig>({
    useOss: false,
    model: 'gpt-5',
    reasoning: 'high',
    provider: 'openai',
    approvalPolicy: 'on-request',
    sandboxMode: 'workspace-write',
    customArgs: [],
    envVars: {},
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    postMessage({ type: 'getConfig' });
    
    const cleanup = setupMessageListener((message) => {
      if (message.type === 'configData') {
        setSettingsData({
          config: message.config || config,
          modelOptions: message.modelOptions || {},
          providers: message.providers || [],
          approvalPolicies: message.approvalPolicies || [],
          sandboxModes: message.sandboxModes || [],
          providerEnvVars: message.providerEnvVars || {},
        });
        setConfig(message.config || config);
        setLoading(false);
      }
    });

    return cleanup;
  }, []);

  const handleSave = () => {
    setSaving(true);
    postMessage({
      type: 'updateConfig',
      config
    });
    // Simulate save completion
    setTimeout(() => setSaving(false), 1000);
  };

  const handleReset = () => {
    postMessage({ type: 'resetConfig' });
  };

  const updateConfig = <K extends keyof CodexConfig>(
    key: K,
    value: CodexConfig[K]
  ) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const updateEnvVar = (key: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      envVars: {
        ...prev.envVars,
        [key]: value
      }
    }));
  };

  const updateCustomArgs = (args: string) => {
    const argsArray = args.split('\n').filter(arg => arg.trim() !== '');
    updateConfig('customArgs', argsArray);
  };

  const getCommandPreview = () => {
    const args: string[] = ['codex'];
    
    if (config.useOss) {
      args.push('--oss');
      args.push('-c', 'model_provider=oss');
    }
    
    if (config.provider && !config.useOss) {
      args.push('-c', `model_provider=${config.provider}`);
    }
    
    if (config.model) {
      args.push('-c', `model="${config.model}"`);
    }
    
    if (config.reasoning) {
      args.push('-c', `model_reasoning_effort=${config.reasoning}`);
    }
    
    if (config.approvalPolicy) {
      args.push('-c', `approval_policy=${config.approvalPolicy}`);
    }
    
    if (config.sandboxMode) {
      args.push('-c', `sandbox_mode=${config.sandboxMode}`);
    }
    
    if (config.customArgs.length > 0) {
      args.push(...config.customArgs);
    }
    
    return args.join(' ');
  };

  if (loading || !settingsData) {
    return (
      <div className="flex flex-col h-full bg-[var(--vscode-editor-background)]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--vscode-panel-border)]">
          <h2 className="text-lg font-semibold text-[var(--vscode-foreground)] flex items-center gap-2">
            ⚙️ Codexia Settings
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-[var(--vscode-foreground)] opacity-70">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[var(--vscode-editor-background)]">
      <div className="flex items-center justify-between p-4 border-b border-[var(--vscode-panel-border)]">
        <h2 className="text-lg font-semibold text-[var(--vscode-foreground)] flex items-center gap-2">
          ⚙️ Codexia Settings
        </h2>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 text-sm bg-[var(--vscode-button-secondaryBackground)] text-[var(--vscode-button-secondaryForeground)] border border-[var(--vscode-button-border)] rounded hover:bg-[var(--vscode-button-secondaryHoverBackground)] transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        {/* OSS Mode */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useOss"
              checked={config.useOss}
              onChange={(e) => updateConfig('useOss', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="useOss" className="text-[var(--vscode-foreground)] font-medium">
              Use OSS Mode (--oss)
            </label>
          </div>
          <p className="text-sm text-[var(--vscode-descriptionForeground)] ml-7">
            Enable to use local open source models via Ollama
          </p>
        </div>

        {/* Provider Selection */}
        {!config.useOss && (
          <div className="space-y-3">
            <label htmlFor="provider" className="block text-[var(--vscode-foreground)] font-medium">
              Provider
            </label>
            <select
              id="provider"
              value={config.provider}
              onChange={(e) => updateConfig('provider', e.target.value)}
              className="w-full p-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
            >
              <option value="">Select a provider...</option>
              {settingsData.providers.map(provider => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
          </div>
        )}

        {/* Environment Variables */}
        {!config.useOss && config.provider && settingsData.providerEnvVars[config.provider] && settingsData.providerEnvVars[config.provider].length > 0 && (
          <div className="space-y-3">
            <label className="block text-[var(--vscode-foreground)] font-medium">API Key</label>
            {settingsData.providerEnvVars[config.provider].map(envVar => (
              <div key={envVar} className="space-y-2">
                <input
                  type="password"
                  placeholder={`Enter ${envVar}`}
                  value={config.envVars[envVar] || ''}
                  onChange={(e) => updateEnvVar(envVar, e.target.value)}
                  className="w-full p-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
                />
              </div>
            ))}
            <p className="text-sm text-[var(--vscode-descriptionForeground)]">
              Set environment variables for API authentication
            </p>
          </div>
        )}

        {/* Model Selection */}
        <div className="space-y-3">
          <label htmlFor="model" className="block text-[var(--vscode-foreground)] font-medium">
            Model (-m)
          </label>
          <select
            id="model"
            value={config.model}
            onChange={(e) => updateConfig('model', e.target.value)}
            className="w-full p-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
          >
            <option value="">Select a model...</option>
            {config.useOss
              ? settingsData.modelOptions.ollama?.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))
              : settingsData.modelOptions[config.provider]?.map(model => (
                  <option key={model} value={model}>{model}</option>
                ))
            }
          </select>
        </div>

        {/* Reasoning */}
        <div className="space-y-3">
          <label htmlFor="reasoning" className="block text-[var(--vscode-foreground)] font-medium">
            Reasoning Effort
          </label>
          <select
            id="reasoning"
            value={config.reasoning}
            onChange={(e) => updateConfig('reasoning', e.target.value)}
            className="w-full p-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>

        {/* Approval Policy */}
        <div className="space-y-3">
          <label htmlFor="approval" className="block text-[var(--vscode-foreground)] font-medium">
            Approval Policy
          </label>
          <select
            id="approval"
            value={config.approvalPolicy}
            onChange={(e) => updateConfig('approvalPolicy', e.target.value)}
            className="w-full p-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
          >
            <option value="">Select approval policy...</option>
            {settingsData.approvalPolicies.map(policy => (
              <option key={policy} value={policy}>{policy}</option>
            ))}
          </select>
          <p className="text-sm text-[var(--vscode-descriptionForeground)]">
            Controls when you need to approve AI actions
          </p>
        </div>

        {/* Sandbox Mode */}
        <div className="space-y-3">
          <label htmlFor="sandbox" className="block text-[var(--vscode-foreground)] font-medium">
            Sandbox Mode
          </label>
          <select
            id="sandbox"
            value={config.sandboxMode}
            onChange={(e) => updateConfig('sandboxMode', e.target.value)}
            className="w-full p-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none"
          >
            <option value="">Select sandbox mode...</option>
            {settingsData.sandboxModes.map(mode => (
              <option key={mode} value={mode}>{mode}</option>
            ))}
          </select>
          <p className="text-sm text-[var(--vscode-descriptionForeground)]">
            Controls what files AI can access and modify
          </p>
        </div>

        {/* Custom Arguments */}
        <div className="space-y-3">
          <label htmlFor="customArgs" className="block text-[var(--vscode-foreground)] font-medium">
            Custom Arguments
          </label>
          <textarea
            id="customArgs"
            value={config.customArgs.join('\n')}
            onChange={(e) => updateCustomArgs(e.target.value)}
            placeholder="Additional codex arguments (one per line)"
            rows={4}
            className="w-full p-2 bg-[var(--vscode-input-background)] text-[var(--vscode-input-foreground)] border border-[var(--vscode-input-border)] rounded focus:border-[var(--vscode-focusBorder)] outline-none resize-none"
          />
          <p className="text-sm text-[var(--vscode-descriptionForeground)]">
            Additional command line arguments for codex (advanced)
          </p>
        </div>

        {/* Command Preview */}
        <div className="space-y-3">
          <label className="block text-[var(--vscode-foreground)] font-medium">Command Preview</label>
          <div className="p-3 bg-[var(--vscode-textCodeBlock-background)] border border-[var(--vscode-panel-border)] rounded font-mono text-sm text-[var(--vscode-textPreformat-foreground)] overflow-x-auto">
            {getCommandPreview()}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="p-4 border-t border-[var(--vscode-panel-border)]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 px-4 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] rounded hover:bg-[var(--vscode-button-hoverBackground)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};

export default SettingsView;