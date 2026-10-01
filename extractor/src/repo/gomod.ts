const COLLECTOR_PREFIX = "github.com/open-telemetry/opentelemetry-collector";

export interface GoMod {
  module: string;
  requires: string[];
}

export function isCollectorModule(path: string): boolean {
  if (!path.startsWith(COLLECTOR_PREFIX)) return false;
  const rest = path.slice(COLLECTOR_PREFIX.length);
  return rest === "" || rest.startsWith("/") || rest.startsWith("-");
}

function stripComment(line: string): string {
  const index = line.indexOf("//");
  return index === -1 ? line : line.slice(0, index);
}

function firstToken(line: string): string {
  const match = /^\S+/.exec(line.trim());
  return match === null ? "" : match[0];
}

export function parseGoMod(text: string): GoMod | null {
  let module: string | null = null;
  const requires = new Set<string>();
  let block: "require" | "skip" | null = null;

  const collect = (line: string): void => {
    const token = firstToken(line);
    if (token !== "" && isCollectorModule(token)) requires.add(token);
  };

  for (const raw of text.split("\n")) {
    const line = stripComment(raw).trim();
    if (line === "") continue;
    if (block !== null) {
      if (line === ")") block = null;
      else if (block === "require") collect(line);
      continue;
    }
    if (line.startsWith("module ")) {
      module = line.slice("module ".length).trim();
      continue;
    }
    const open = /^([a-z]+)\s+\($/.exec(line);
    if (open !== null) {
      block = open[1] === "require" ? "require" : "skip";
      continue;
    }
    if (line.startsWith("require ")) collect(line.slice("require ".length));
  }

  if (module === null || module === "") return null;
  return { module, requires: [...requires].sort() };
}
