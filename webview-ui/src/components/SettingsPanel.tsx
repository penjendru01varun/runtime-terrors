import React, { useState, useEffect } from 'react';
import { Key, Globe, Cpu, Check, AlertCircle } from 'lucide-react';
import type { TrueForgeConnectionState } from '../types/messageProtocol';

interface SettingsPanelProps {
  settings: {
    trueforgeUrl: string;
    hasToken: boolean;
    defaultModel: string;
  };
  connection: TrueForgeConnectionState;
  onSave: (payload: { trueforgeUrl: string; apiToken?: string; defaultModel: string }) => void;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  connection,
  onSave,
  onClose,
}) => {
  const [url, setUrl] = useState(settings.trueforgeUrl);
  const [token, setToken] = useState('');
  const [model, setModel] = useState(settings.defaultModel);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setUrl(settings.trueforgeUrl);
    setModel(settings.defaultModel);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      trueforgeUrl: url.trim(),
      apiToken: token.trim() ? token.trim() : undefined,
      defaultModel: model.trim(),
    });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col h-full bg-[#0f1117] text-gray-200 p-4 overflow-y-auto">
      <div className="flex items-center justify-between pb-3 border-b border-[#2a3042] mb-4">
        <h2 className="text-sm font-semibold text-purple-300 flex items-center gap-2">
          TrueForge Runtime Configuration
        </h2>
        <button
          onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-[#1e2230]"
        >
          Back to Chat
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* TrueForge Server URL */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            TrueForge Server Endpoint URL
          </label>
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="http://127.0.0.1:8790"
            className="w-full text-xs px-3 py-2 bg-[#161922] border border-[#2a3042] rounded-md text-gray-100 focus:outline-none focus:border-purple-500 font-mono"
            required
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Default local standalone port is 8790. Point to your hosted cluster for remote runs.
          </p>
        </div>

        {/* API Token / Secret */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-purple-400" />
            Bearer API Token (Optional in Standalone)
          </label>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={settings.hasToken ? '•••••••••••••••• (Configured in SecretStorage)' : 'Leave empty for standalone mode'}
            className="w-full text-xs px-3 py-2 bg-[#161922] border border-[#2a3042] rounded-md text-gray-100 focus:outline-none focus:border-purple-500 font-mono"
          />
          <p className="text-[11px] text-gray-500 mt-1">
            Stored securely via VS Code native SecretStorage. Never saved in plain-text settings.
          </p>
        </div>

        {/* Default Model */}
        <div>
          <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            Model Provider & Name
          </label>
          {connection.models && connection.models.length > 0 ? (
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              className="w-full text-xs px-3 py-2 bg-[#161922] border border-[#2a3042] rounded-md text-gray-100 focus:outline-none focus:border-purple-500"
            >
              {connection.models.map(m => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={model}
              onChange={e => setModel(e.target.value)}
              placeholder="openai/gpt-4o or anthropic/claude-3-7-sonnet"
              className="w-full text-xs px-3 py-2 bg-[#161922] border border-[#2a3042] rounded-md text-gray-100 focus:outline-none focus:border-purple-500 font-mono"
            />
          )}
          <p className="text-[11px] text-gray-500 mt-1">
            Must be a model enabled in your TrueForge catalog (e.g. <span className="font-mono text-purple-300">openai/gpt-4o</span>).
          </p>
        </div>

        {/* Status display */}
        {connection.error && (
          <div className="p-2.5 rounded bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">TrueForge Connection Error</p>
              <p className="text-[11px] opacity-90">{connection.error}</p>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="submit"
            className="flex-1 text-xs font-medium px-4 py-2 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white rounded-md transition-colors flex items-center justify-center gap-1.5"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Settings Saved!
              </>
            ) : (
              'Save & Test Connection'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

