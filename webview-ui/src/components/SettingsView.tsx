import React, { useState, useEffect } from 'react';
import { postMessage, setupMessageListener } from '../utils/vscode-api';

interface SettingsViewProps {
  onDone: () => void;
}

interface SettingsData {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  autoSave: boolean;
  theme: string;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onDone }) => {
  const [settings, setSettings] = useState<SettingsData>({
    apiKey: '',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 4000,
    autoSave: true,
    theme: 'dark'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Request current settings from extension
    postMessage({ type: 'getSettings' });
    
    const cleanup = setupMessageListener((message) => {
      if (message.type === 'settings') {
        setSettings(message.settings || settings);
        setLoading(false);
      } else if (message.type === 'settingsSaved') {
        setSaving(false);
      }
    });

    return cleanup;
  }, []);

  const handleSave = () => {
    setSaving(true);
    postMessage({
      type: 'saveSettings',
      settings
    });
  };

  const handleReset = () => {
    postMessage({ type: 'resetSettings' });
  };

  const updateSetting = <K extends keyof SettingsData>(
    key: K,
    value: SettingsData[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  if (loading) {
    return (
      <div className="settings-view">
        <div className="settings-header">
          <button onClick={onDone} className="back-button">
            ← Back to Chat
          </button>
          <h2>Settings</h2>
        </div>
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="settings-view">
      <div className="settings-header">
        <button onClick={onDone} className="back-button">
          ← Back to Chat
        </button>
        <h2>Settings</h2>
      </div>
      
      <div className="settings-content">
        <div className="settings-section">
          <h3>API Configuration</h3>
          
          <div className="setting-item">
            <label htmlFor="apiKey">API Key</label>
            <input
              id="apiKey"
              type="password"
              value={settings.apiKey}
              onChange={(e) => updateSetting('apiKey', e.target.value)}
              placeholder="Enter your API key"
              className="setting-input"
            />
          </div>

          <div className="setting-item">
            <label htmlFor="model">Model</label>
            <select
              id="model"
              value={settings.model}
              onChange={(e) => updateSetting('model', e.target.value)}
              className="setting-select"
            >
              <option value="gpt-4">GPT-4</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
            </select>
          </div>
        </div>

        <div className="settings-section">
          <h3>Generation Parameters</h3>
          
          <div className="setting-item">
            <label htmlFor="temperature">Temperature: {settings.temperature}</label>
            <input
              id="temperature"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => updateSetting('temperature', parseFloat(e.target.value))}
              className="setting-range"
            />
            <div className="range-labels">
              <span>More focused</span>
              <span>More creative</span>
            </div>
          </div>

          <div className="setting-item">
            <label htmlFor="maxTokens">Max Tokens</label>
            <input
              id="maxTokens"
              type="number"
              min="100"
              max="8000"
              value={settings.maxTokens}
              onChange={(e) => updateSetting('maxTokens', parseInt(e.target.value))}
              className="setting-input"
            />
          </div>
        </div>

        <div className="settings-section">
          <h3>Preferences</h3>
          
          <div className="setting-item checkbox-item">
            <input
              id="autoSave"
              type="checkbox"
              checked={settings.autoSave}
              onChange={(e) => updateSetting('autoSave', e.target.checked)}
              className="setting-checkbox"
            />
            <label htmlFor="autoSave">Auto-save chat sessions</label>
          </div>

          <div className="setting-item">
            <label htmlFor="theme">Theme</label>
            <select
              id="theme"
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value)}
              className="setting-select"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">Auto (Follow VS Code)</option>
            </select>
          </div>
        </div>

        <div className="settings-actions">
          <button
            onClick={handleSave}
            disabled={saving}
            className="save-button"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <button
            onClick={handleReset}
            className="reset-button"
          >
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;