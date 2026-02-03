/**
 * Client-side logging utility that collects logs and allows downloading them
 */

type LogEntry = {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  data?: any;
};

class LogCollector {
  private logs: LogEntry[] = [];
  private originalConsole: {
    log: typeof console.log;
    warn: typeof console.warn;
    error: typeof console.error;
    info: typeof console.info;
  };

  constructor() {
    // Store original console methods
    this.originalConsole = {
      log: console.log.bind(console),
      warn: console.warn.bind(console),
      error: console.error.bind(console),
      info: console.info.bind(console),
    };

    // Intercept console methods
    this.setupInterceptors();
  }

  private setupInterceptors() {
    console.log = (...args: any[]) => {
      this.addLog('log', args);
      this.originalConsole.log(...args);
    };

    console.warn = (...args: any[]) => {
      this.addLog('warn', args);
      this.originalConsole.warn(...args);
    };

    console.error = (...args: any[]) => {
      this.addLog('error', args);
      this.originalConsole.error(...args);
    };

    console.info = (...args: any[]) => {
      this.addLog('info', args);
      this.originalConsole.info(...args);
    };
  }

  private addLog(level: LogEntry['level'], args: any[]) {
    const timestamp = new Date().toISOString();
    const message = args[0]?.toString() || '';
    const data = args.length > 1 ? args.slice(1) : undefined;

    this.logs.push({
      timestamp,
      level,
      message,
      data,
    });

    // Keep only last 10000 logs to prevent memory issues
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(-10000);
    }
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }

  public downloadLogs(filename: string = 'weleap-logs.txt') {
    if (this.logs.length === 0) {
      console.warn('No logs to download');
      alert('No logs to download. Make sure you have interacted with the app to generate logs.');
      return;
    }

    const logText = this.logs
      .map((log) => {
        const dataStr = log.data
          ? '\n' + JSON.stringify(log.data, null, 2)
          : '';
        return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${dataStr}`;
      })
      .join('\n\n');

    try {
      const blob = new Blob([logText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log(`Downloaded ${this.logs.length} log entries to ${filename}`);
    } catch (error) {
      console.error('Failed to download logs:', error);
      alert('Failed to download logs. Check the console for details.');
    }
  }

  public copyLogsToClipboard() {
    const logText = this.logs
      .map((log) => {
        const dataStr = log.data
          ? '\n' + JSON.stringify(log.data, null, 2)
          : '';
        return `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${dataStr}`;
      })
      .join('\n\n');

    navigator.clipboard.writeText(logText).then(() => {
      alert('Logs copied to clipboard!');
    });
  }

  public getLogsAsJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  public downloadLogsAsJSON(filename: string = 'weleap-logs.json') {
    if (this.logs.length === 0) {
      console.warn('No logs to download');
      alert('No logs to download. Make sure you have interacted with the app to generate logs.');
      return;
    }

    try {
      const json = this.getLogsAsJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      
      // Clean up after a short delay
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      console.log(`Downloaded ${this.logs.length} log entries to ${filename}`);
    } catch (error) {
      console.error('Failed to download logs:', error);
      alert('Failed to download logs. Check the console for details.');
    }
  }
}

// Create singleton instance
let logCollector: LogCollector | null = null;

export function getLogCollector(): LogCollector {
  if (typeof window === 'undefined') {
    throw new Error('LogCollector can only be used in the browser');
  }

  if (!logCollector) {
    logCollector = new LogCollector();
  }

  return logCollector;
}

// Make it available globally for easy access
if (typeof window !== 'undefined') {
  (window as any).weleapLogger = {
    download: () => getLogCollector().downloadLogs(),
    downloadJSON: () => getLogCollector().downloadLogsAsJSON(),
    copy: () => getLogCollector().copyLogsToClipboard(),
    clear: () => getLogCollector().clearLogs(),
    getLogs: () => getLogCollector().getLogs(),
  };
}

