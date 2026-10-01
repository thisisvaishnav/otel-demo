import { describe, expect, it } from "vitest";
import { isCollectorModule, parseGoMod } from "./gomod";

const CONTRIBUT = "github.com/open-telemetry/opentelemetry-collector-contrib";

const SAMPLE = `module ${CONTRIBUT}/receiver/prometheusreceiver

go 1.26.0

retract (
	v0.76.2 // superseded
	v0.76.1
)

require (
	github.com/open-telemetry/opentelemetry-collector-contrib/exporter/prometheusremotewriteexporter v0.162.0
	github.com/open-telemetry/opentelemetry-collector-contrib/pkg/ottl v0.162.0 // indirect
	github.com/open-telemetry/opentelemetry-collector-contrib/pkg/ottl v0.162.0
	github.com/prometheus/prometheus v0.315.0
	go.opentelemetry.io/collector/pdata v1.68.1
)

require ${CONTRIBUT}/internal/coreinternal v0.162.0

replace (
	${CONTRIBUT}/replacedmodule => ./local
)
`;

describe("isCollectorModule", () => {
  it("accepts contrib module paths and rejects lookalikes", () => {
    expect(isCollectorModule(CONTRIBUT)).toBe(true);
    expect(isCollectorModule(`${CONTRIBUT}/receiver/foo`)).toBe(true);
    expect(
      isCollectorModule("github.com/open-telemetry/opentelemetry-collector/receiver/foo"),
    ).toBe(true);
    expect(isCollectorModule("github.com/open-telemetry/opentelemetry-collectorfoo")).toBe(false);
    expect(isCollectorModule("github.com/pkg/errors")).toBe(false);
  });
});

describe("parseGoMod", () => {
  it("reads the module directive and collector requires only", () => {
    const parsed = parseGoMod(SAMPLE);
    expect(parsed).not.toBeNull();
    expect(parsed?.module).toBe(`${CONTRIBUT}/receiver/prometheusreceiver`);
    expect(parsed?.requires).toEqual([
      `${CONTRIBUT}/exporter/prometheusremotewriteexporter`,
      `${CONTRIBUT}/internal/coreinternal`,
      `${CONTRIBUT}/pkg/ottl`,
    ]);
  });

  it("ignores block-scoped replace and retract entries", () => {
    const parsed = parseGoMod(SAMPLE);
    expect(parsed?.requires.some((require) => require.includes("replacedmodule"))).toBe(false);
  });

  it("returns null when the module directive is missing", () => {
    expect(parseGoMod("go 1.26.0\n\nrequire (\n\tgithub.com/pkg/errors v1.0.0\n)\n")).toBeNull();
    expect(parseGoMod("")).toBeNull();
  });

  it("handles a bare require block with no collector modules", () => {
    const parsed = parseGoMod("module m\n\nrequire (\n\tgithub.com/pkg/errors v0.9.1\n)\n");
    expect(parsed).toEqual({ module: "m", requires: [] });
  });
});
