import { describe, expect, it } from "vitest";
import { fallbackComponent, parseMetadata } from "./parse";

function parse(yaml: string, id = "receiver/example") {
  const warnings: string[] = [];
  const component = parseMetadata(yaml, id, "receiver", (message) => warnings.push(message));
  return { component, warnings };
}

const ALPHA = `
display_name: Alpha Receiver
type: alpha
description: |
  First paragraph line one.

  Second paragraph.
status:
  class: receiver
  stability:
    alpha: [metrics]
  distributions: [contrib]
  codeowners:
    active: [alice]
    emeritus: [bob]
`;

const BETA = `
display_name: Beta Receiver
type: beta
status:
  class: receiver
  stability:
    beta: [traces, logs]
  distributions: [core, k8s]
  codeowners:
    active: [carol]
    seeking_new: true
`;

const STABLE = `
display_name: Stable Receiver
type: stable
status:
  class: receiver
  stability:
    stable: [metrics, logs, traces]
  distributions: [contrib]
  codeowners:
    active: [dave]
`;

describe("parseMetadata", () => {
  it("parses alpha stability", () => {
    const { component } = parse(ALPHA);
    expect(component?.status_quality).toBe("metadata");
    expect(component?.signals).toEqual({ metrics: "alpha" });
    expect(component?.codeowners).toEqual({
      active: ["alice"],
      emeritus: ["bob"],
      seeking_new: false,
    });
    expect(component?.description).toBe("First paragraph line one.");
  });

  it("parses beta stability", () => {
    const { component } = parse(BETA);
    expect(component?.signals).toEqual({ traces: "beta", logs: "beta" });
    expect(component?.distributions).toEqual(["core", "k8s"]);
    expect(component?.codeowners.seeking_new).toBe(true);
  });

  it("parses stable stability", () => {
    const { component } = parse(STABLE);
    expect(component?.signals).toEqual({ metrics: "stable", logs: "stable", traces: "stable" });
  });

  it("maps connector *_to_* entries onto both signals", () => {
    const { component } = parse(
      `
status:
  class: connector
  stability:
    alpha: [traces_to_traces, metrics_to_metrics]
`,
      "connector/routing",
    );
    expect(component?.signals).toEqual({ traces: "alpha", metrics: "alpha" });
  });

  it("keeps development stability and profiles signal", () => {
    const { component } = parse(
      `
status:
  class: exporter
  stability:
    development: [profiles]
    alpha: [metrics]
`,
      "exporter/clickhouse",
    );
    expect(component?.signals).toEqual({ profiles: "development", metrics: "alpha" });
  });

  it("parses feature gates", () => {
    const { component } = parse(
      `
status:
  class: receiver
  stability:
    beta: [metrics]
feature_gates:
  - id: receiver.example.gate
    stage: alpha
    description: A gate.
    from_version: v0.1.0
    reference_url: https://example.com/issue/1
`,
    );
    expect(component?.feature_gates).toEqual([
      {
        id: "receiver.example.gate",
        stage: "alpha",
        description: "A gate.",
        from_version: "v0.1.0",
        reference_url: "https://example.com/issue/1",
      },
    ]);
  });

  it("keeps deprecated and unmaintained stability levels", () => {
    const deprecated = parse(
      `
status:
  class: exporter
  stability:
    deprecated: [traces]
`,
      "exporter/signalfx",
    );
    expect(deprecated.component?.signals).toEqual({ traces: "deprecated" });
    expect(deprecated.warnings).toEqual([]);
    const unmaintained = parse(
      `
status:
  class: receiver
  stability:
    unmaintained: [metrics]
`,
      "receiver/simpleprometheus",
    );
    expect(unmaintained.component?.signals).toEqual({ metrics: "unmaintained" });
    expect(unmaintained.warnings).toEqual([]);
  });

  it("skips the extension token without a warning", () => {
    const { component, warnings } = parse(
      `
status:
  class: extension
  stability:
    beta: [extension]
`,
      "extension/pprof",
    );
    expect(component?.signals).toEqual({});
    expect(warnings).toEqual([]);
  });

  it("warns and drops unknown distributions", () => {
    const { component, warnings } = parse(
      `
status:
  class: receiver
  stability:
    beta: [metrics]
  distributions: [contrib, experimental]
`,
    );
    expect(component?.distributions).toEqual(["contrib"]);
    expect(warnings.join(" ")).toContain("experimental");
  });

  it("returns null for malformed yaml", () => {
    const { component, warnings } = parse("status: [unterminated");
    expect(component).toBeNull();
    expect(warnings.join(" ")).toContain("malformed metadata.yaml");
  });

  it("returns null when metadata is not a mapping", () => {
    expect(parse("- just\n- a list").component).toBeNull();
  });

  it("truncates long descriptions at a word boundary", () => {
    const long = "word ".repeat(300);
    const { component } = parse(`
display_name: Long
type: long
description: |
  ${long}
status:
  class: receiver
  stability:
    beta: [metrics]
`);
    expect(component?.description.length).toBeLessThanOrEqual(601);
    expect(component?.description.endsWith("…")).toBe(true);
  });
});

describe("fallbackComponent", () => {
  it("badges components without metadata instead of dropping them", () => {
    const component = fallbackComponent("receiver/filelogreceiver", "receiver");
    expect(component.status_quality).toBe("unknown");
    expect(component.id).toBe("receiver/filelogreceiver");
    expect(component.type).toBe("filelog");
    expect(component.signals).toEqual({});
    expect(component.source_url).toContain("receiver/filelogreceiver");
  });

  it("keeps the directory name when the class suffix does not match", () => {
    expect(fallbackComponent("connector/routing", "connector").type).toBe("routing");
  });
});
