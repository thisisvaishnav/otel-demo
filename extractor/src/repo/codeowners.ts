import type { CodeownersRule } from "@otel-demo/schema";

function globToRegExp(pattern: string, anchored: boolean): RegExp {
  let out = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      if (pattern[index + 1] === "*") {
        if (pattern[index + 2] === "/") {
          out += "(?:.*/)?";
          index += 2;
        } else {
          out += ".*";
          index += 1;
        }
      } else {
        out += "[^/]*";
      }
    } else if (char === "?") {
      out += "[^/]";
    } else if (char === "[") {
      const close = pattern.indexOf("]", index + 1);
      if (close === -1) {
        out += "\\[";
      } else {
        out += pattern.slice(index, close + 1).replace(/^!/, "^");
        index = close;
      }
    } else {
      out += char.replace(/[.+^${}()|\\]/g, "\\$&");
    }
  }
  return new RegExp(anchored ? `^${out}$` : `(^|/)${out}$`);
}

export function matchesCodeownersPattern(pattern: string, path: string): boolean {
  if (pattern === "*") return true;
  if (pattern.endsWith("/")) return path.startsWith(`${pattern.slice(0, -1)}/`);
  if (pattern.includes("/")) return globToRegExp(pattern, true).test(path);
  const normalized = path.endsWith("/") ? path.slice(0, -1) : path;
  return globToRegExp(pattern, false).test(normalized);
}

export function parseCodeowners(text: string): CodeownersRule[] {
  const rules: CodeownersRule[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.split("#")[0].trim();
    if (line === "") continue;
    const parts = line.split(/\s+/);
    const owners = parts.slice(1).filter((owner) => owner.startsWith("@") || owner.includes("@"));
    if (owners.length === 0) continue;
    rules.push({ pattern: parts[0], owners });
  }
  return rules;
}

export function resolveOwners(rules: CodeownersRule[], path: string): string[] {
  let owners: string[] = [];
  for (const rule of rules) {
    if (matchesCodeownersPattern(rule.pattern, path)) owners = rule.owners;
  }
  return owners;
}
