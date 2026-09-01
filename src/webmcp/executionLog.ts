export interface WebMCPExecutionLogEntry {
  timestamp: string;
  name: string;
  input: Record<string, unknown>;
  success: boolean;
  error?: string;
  duration: number;
  summary: string;
}

const MAX_ENTRIES = 100;
const entries: WebMCPExecutionLogEntry[] = [];
const listeners = new Set<() => void>();

const cloneInput = (input: Record<string, unknown>) => {
  try {
    return structuredClone(input);
  } catch {
    return { ...input };
  }
};

export function recordWebMCPExecution(entry: Omit<WebMCPExecutionLogEntry, 'timestamp'> & { timestamp?: string }) {
  entries.push({
    ...entry,
    timestamp: entry.timestamp ?? new Date().toISOString(),
    input: cloneInput(entry.input),
  });
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
  listeners.forEach((listener) => listener());
}

export function readWebMCPExecutionLog(): WebMCPExecutionLogEntry[] {
  return structuredClone(entries);
}

export const getWebMCPExecutionLog = readWebMCPExecutionLog;

export function clearWebMCPExecutionLog() {
  entries.length = 0;
  listeners.forEach((listener) => listener());
}

export function subscribeWebMCPExecutionLog(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
