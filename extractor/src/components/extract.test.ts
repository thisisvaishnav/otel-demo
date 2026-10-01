import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractComponents } from "./extract";

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "otel-extractor-"));
  const valid = `
display_name: Valid Receiver
type: valid
status:
  class: receiver
  stability:
    beta: [metrics]
  distributions: [contrib]
  codeowners:
    active: [alice]
`;
  mkdirSync(join(root, "receiver", "validreceiver"), { recursive: true });
  writeFileSync(join(root, "receiver", "validreceiver", "metadata.yaml"), valid);
  mkdirSync(join(root, "receiver", "noreceiver"), { recursive: true });
  mkdirSync(join(root, "processor", "badprocessor"), { recursive: true });
  writeFileSync(join(root, "processor", "badprocessor", "metadata.yaml"), "status: [broken");
  mkdirSync(join(root, "scraper", "zookeeperscraper"), { recursive: true });
  writeFileSync(
    join(root, "scraper", "zookeeperscraper", "metadata.yaml"),
    `
display_name: ZooKeeper Scraper
type: zookeeper
status:
  class: scraper
  stability:
    stable: [metrics]
  distributions: [contrib]
  codeowners:
    active: [zoe]
`,
  );
  return root;
}

describe("extractComponents", () => {
  it("keeps components with missing or malformed metadata", () => {
    const { components } = extractComponents(fixtureRepo());
    expect(components.map((component) => component.id)).toEqual([
      "processor/badprocessor",
      "receiver/noreceiver",
      "receiver/validreceiver",
      "scraper/zookeeperscraper",
    ]);
    const byId = new Map(components.map((component) => [component.id, component]));
    expect(byId.get("receiver/validreceiver")?.status_quality).toBe("metadata");
    expect(byId.get("receiver/validreceiver")?.signals).toEqual({ metrics: "beta" });
    expect(byId.get("receiver/noreceiver")?.status_quality).toBe("unknown");
    expect(byId.get("processor/badprocessor")?.status_quality).toBe("unknown");
    expect(byId.get("scraper/zookeeperscraper")?.class).toBe("scraper");
  });

  it("reports a warning per unusable component", () => {
    const { warnings } = extractComponents(fixtureRepo());
    expect(warnings.some((warning) => warning.includes("receiver/noreceiver"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("processor/badprocessor"))).toBe(true);
  });
});
