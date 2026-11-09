import * as vscode from 'vscode';

const SECRET_KEY_API_TOKEN = 'runtimeTerrors.trueforgeApiToken';

export class SettingsManager {
  private static instance: SettingsManager;
  private secretStorage: vscode.SecretStorage | undefined;

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  public init(context: vscode.ExtensionContext) {
    this.secretStorage = context.secrets;
  }

  public getTrueForgeUrl(): string {
    const config = vscode.workspace.getConfiguration('runtimeTerrors');
    const raw = config.get<string>('trueforgeUrl') || 'http://127.0.0.1:8790';
    return raw.replace(/\/+$/, '');
  }

  public async setTrueForgeUrl(url: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('runtimeTerrors');
    await config.update('trueforgeUrl', url.trim().replace(/\/+$/, ''), vscode.ConfigurationTarget.Global);
  }

  public getDefaultModel(): string {
    const config = vscode.workspace.getConfiguration('runtimeTerrors');
    return config.get<string>('defaultModel') || 'openai/gpt-4o';
  }

  public async setDefaultModel(model: string): Promise<void> {
    const config = vscode.workspace.getConfiguration('runtimeTerrors');
    await config.update('defaultModel', model.trim(), vscode.ConfigurationTarget.Global);
  }

  public async getApiToken(): Promise<string | undefined> {
    if (!this.secretStorage) return undefined;
    return await this.secretStorage.get(SECRET_KEY_API_TOKEN);
  }

  public async setApiToken(token: string | undefined): Promise<void> {
    if (!this.secretStorage) return;
    if (token && token.trim()) {
      await this.secretStorage.store(SECRET_KEY_API_TOKEN, token.trim());
    } else {
      await this.secretStorage.delete(SECRET_KEY_API_TOKEN);
    }
  }

  public async hasApiToken(): Promise<boolean> {
    const token = await this.getApiToken();
    return Boolean(token && token.trim().length > 0);
  }
}

export const settingsManager = SettingsManager.getInstance();

