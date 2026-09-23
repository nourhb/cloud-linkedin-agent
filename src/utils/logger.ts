/**
 * Minimal structured logger. No external dependency (SPEC section 74:
 * "keep dependencies minimal").
 *
 * IMPORTANT: never pass secrets (LINKEDIN_ACCESS_TOKEN, LINKEDIN_CLIENT_SECRET,
 * GEMINI_API_KEY) directly as log context. `redact()` is provided as a
 * defensive helper, but callers must still avoid logging raw tokens.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type LogContext = Record<string, unknown>;

const SECRET_KEY_PATTERN = /token|secret|key|password|authorization/i;

function redactContext(context: LogContext | undefined): LogContext | undefined {
  if (!context) return context;
  const redacted: LogContext = {};
  for (const [key, value] of Object.entries(context)) {
    redacted[key] = SECRET_KEY_PATTERN.test(key) ? '[REDACTED]' : value;
  }
  return redacted;
}

function formatContext(context: LogContext | undefined): string {
  if (!context || Object.keys(context).length === 0) return '';
  const parts = Object.entries(context).map(([key, value]) => {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return `${key}=${serialized}`;
  });
  return ' ' + parts.join(' ');
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  const timestamp = new Date().toISOString();
  const tag = level.toUpperCase();
  const safeContext = redactContext(context);
  const line = `${timestamp} [${tag}] ${message}${formatContext(safeContext)}`;
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
};
