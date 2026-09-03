export function formatTaskKey(keyPrefix: string, taskNumber: number | null): string | null {
  return taskNumber === null ? null : `${keyPrefix}-${taskNumber}`;
}

export function deriveKeyPrefix(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "");
  return letters.slice(0, 4) || "TASK";
}
