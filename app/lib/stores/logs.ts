import { atom, map } from 'nanostores';
import Cookies from 'js-cookie';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('LogStore');

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
  details?: Record<string, any>;
  category: 'system' | 'provider' | 'user' | 'error' | 'api' | 'auth' | 'database' | 'network';
  subCategory?: string;
  duration?: number;
  statusCode?: number;
}

const MAX_LOGS = 1000; // Maximum number of logs to keep in memory

class LogStore {
  private _logs = map<Record<string, LogEntry>>({});
  showLogs = atom(true);

  constructor() {
    // Load saved logs from cookies on initialization
    this._loadLogs();
  }

  // Expose the logs store for subscription
  get logs() {
    return this._logs;
  }

  private _loadLogs() {
    const savedLogs = Cookies.get('eventLogs');

    if (savedLogs) {
      try {
        const parsedLogs = JSON.parse(savedLogs);
        this._logs.set(parsedLogs);
      } catch (error) {
        logger.error('Failed to parse logs from cookies:', error);
      }
    }
  }

  private _saveLogs() {
    const currentLogs = this._logs.get();
    Cookies.set('eventLogs', JSON.stringify(currentLogs));
  }

  private _generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private _trimLogs() {
    const currentLogs = Object.entries(this._logs.get());

    if (currentLogs.length > MAX_LOGS) {
      const sortedLogs = currentLogs.sort(
        ([, a], [, b]) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
      const newLogs = Object.fromEntries(sortedLogs.slice(0, MAX_LOGS));
      this._logs.set(newLogs);
    }
  }

  addLog(
    message: string,
    level: LogEntry['level'] = 'info',
    category: LogEntry['category'] = 'system',
    details?: Record<string, any>,
  ) {
    const id = this._generateId();
    const entry: LogEntry = {
      id,
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
      category,
    };

    this._logs.setKey(id, entry);
    this._trimLogs();
    this._saveLogs();

    return id;
  }

  // System events
  logSystem(message: string, details?: Record<string, any>) {
    return this.addLog(message, 'info', 'system', details);
  }

  // Provider events
  logProvider(message: string, details?: Record<string, any>) {
    return this.addLog(message, 'info', 'provider', details);
  }

  // User actions
  logUserAction(message: string, details?: Record<string, any>) {
    return this.addLog(message, 'info', 'user', details);
  }

  // API Connection Logging
  logAPIRequest(endpoint: string, method: string, duration: number, statusCode: number, details?: Record<string, any>) {
    const message = `${method} ${endpoint} - ${statusCode} (${duration}ms)`;
    const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warning' : 'info';

    return this.addLog(message, level, 'api', {
      ...details,
      endpoint,
      method,
      duration,
      statusCode,
      timestamp: new Date().toISOString(),
    });
  }

  // Authentication Logging
  logAuth(
    action: 'login' | 'logout' | 'token_refresh' | 'key_validation',
    success: boolean,
    details?: Record<string, any>,
  ) {
    const message = `Auth ${action} - ${success ? 'Success' : 'Failed'}`;
    const level = success ? 'info' : 'error';

    return this.addLog(message, level, 'auth', {
      ...details,
      action,
      success,
      timestamp: new Date().toISOString(),
    });
  }

  // Network Status Logging
  logNetworkStatus(status: 'online' | 'offline' | 'reconnecting' | 'connected', details?: Record<string, any>) {
    const message = `Network ${status}`;
    const level = status === 'offline' ? 'error' : status === 'reconnecting' ? 'warning' : 'info';

    return this.addLog(message, level, 'network', {
      ...details,
      status,
      timestamp: new Date().toISOString(),
    });
  }

  // Database Operations Logging
  logDatabase(operation: string, success: boolean, duration: number, details?: Record<string, any>) {
    const message = `DB ${operation} - ${success ? 'Success' : 'Failed'} (${duration}ms)`;
    const level = success ? 'info' : 'error';

    return this.addLog(message, level, 'database', {
      ...details,
      operation,
      success,
      duration,
      timestamp: new Date().toISOString(),
    });
  }

  // Error events
  logError(message: string, error?: Error | unknown, details?: Record<string, any>) {
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            ...details,
          }
        : { error, ...details };

    return this.addLog(message, 'error', 'error', errorDetails);
  }

  // Warning events
  logWarning(message: string, details?: Record<string, any>) {
    return this.addLog(message, 'warning', 'system', details);
  }

  // Debug events
  logDebug(message: string, details?: Record<string, any>) {
    return this.addLog(message, 'debug', 'system', details);
  }

  clearLogs() {
    this._logs.set({});
    this._saveLogs();
  }

  getLogs() {
    return Object.values(this._logs.get()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }

  getFilteredLogs(level?: LogEntry['level'], category?: LogEntry['category'], searchQuery?: string) {
    return this.getLogs().filter((log) => {
      const matchesLevel = !level || level === 'debug' || log.level === level;
      const matchesCategory = !category || log.category === category;
      const matchesSearch =
        !searchQuery ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        JSON.stringify(log.details).toLowerCase().includes(searchQuery.toLowerCase());

      return matchesLevel && matchesCategory && matchesSearch;
    });
  }
}

export const logStore = new LogStore();
