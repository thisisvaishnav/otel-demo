import type { Signal, Signals, StabilityLevel } from "@otel-demo/schema";

const LEVELS: readonly StabilityLevel[] = [
  "development",
  "alpha",
  "beta",
  "stable",
  "deprecated",
  "unmaintained",
];
const SIGNAL_NAMES: readonly Signal[] = ["traces", "metrics", "logs", "profiles"];
const SIGNAL_SET = new Set<string>(SIGNAL_NAMES);
const NON_SIGNAL_TOKENS = new Set(["extension"]);

function resolveEntry(entry: string): Signal[] {
  if (SIGNAL_SET.has(entry)) return [entry as Signal];
  const match = /^([a-z]+)_to_([a-z]+)$/.exec(entry);
  if (match && SIGNAL_SET.has(match[1]) && SIGNAL_SET.has(match[2])) {
    return [match[1], match[2]] as Signal[];
  }
  return [];
}

export function deriveSignals(stability: unknown, warn: (message: string) => void): Signals {
  const out: Signals = {};
  if (stability === undefined || stability === null) return out;
  if (typeof stability !== "object" || Array.isArray(stability)) {
    warn("status.stability is not a mapping; signals left empty");
    return out;
  }
  const map = stability as Record<string, unknown>;
  for (const level of LEVELS) {
    const entries = map[level];
    if (entries === undefined) continue;
    if (!Array.isArray(entries)) {
      warn(`status.stability.${level} is not a list; skipped`);
      continue;
    }
    for (const raw of entries) {
      if (typeof raw !== "string") continue;
      if (NON_SIGNAL_TOKENS.has(raw)) continue;
      const signals = resolveEntry(raw);
      if (signals.length === 0) {
        warn(`unrecognised stability entry "${String(raw)}" in ${level}; skipped`);
        continue;
      }
      for (const signal of signals) {
        if (out[signal] === undefined) out[signal] = level;
      }
    }
  }
  for (const key of Object.keys(map)) {
    if (!(LEVELS as readonly string[]).includes(key)) {
      warn(`unknown stability level "${key}"; ignored`);
    }
  }
  return out;
}
