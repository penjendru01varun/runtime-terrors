import * as vscode from 'vscode';

class Logger {
  private outputChannel: vscode.OutputChannel | undefined;
  private recentLogs: string[] = [];

  public init() {
    this.getChannel();
  }

  public getChannel(): vscode.OutputChannel {
    if (!this.outputChannel) {
      this.outputChannel = vscode.window.createOutputChannel('Runtime Terrors');
    }
    return this.outputChannel;
  }

  public getRecentLogs(): string[] {
    return [...this.recentLogs];
  }

  public clearRecentLogs(): void {
    this.recentLogs = [];
  }

  public log(message: string, ...args: unknown[]) {
    this.write('INFO', message, args);
  }

  public warn(message: string, ...args: unknown[]) {
    this.write('WARN', message, args);
  }

  public error(message: string, ...args: unknown[]) {
    this.write('ERROR', message, args);
  }

  public show(preserveFocus = true) {
    this.getChannel().show(preserveFocus);
  }

  private write(level: string, message: string, args: unknown[]) {
    const timestamp = new Date().toISOString();
    // Redact potential bearer tokens, api keys, or secrets
    const redact = (str: string) =>
      str
        .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
        .replace(/(key|token|secret|password|authorization)=["']?[^"'\s&]+["']?/gi, '$1=[REDACTED]');

    let sanitized = redact(message);
    if (args.length > 0) {
      const extra = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
      sanitized += ' ' + redact(extra);
    }

    const formatted = `[${timestamp}] [${level}] ${sanitized}`;
    this.recentLogs.push(formatted);
    this.getChannel().appendLine(formatted);

    // Also mirror to extension console so VS Code Developer Tools Console captures it
    if (level === 'ERROR') {
      console.error('[Runtime Terrors]', sanitized);
    } else if (level === 'WARN') {
      console.warn('[Runtime Terrors]', sanitized);
    } else {
      console.log('[Runtime Terrors]', sanitized);
    }
  }
}

export const logger = new Logger();
