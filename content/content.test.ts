import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  Architecture,
  anchorIds,
  CONTENT_SCHEMA_VERSION,
  contribUrl,
  GLOSSARY_MIN_TERMS,
  Glossary,
  Regions,
  StarterIssues,
  Workflow,
} from "@otel-demo/schema";
import { describe, expect, it } from "vitest";
import architectureJson from "./architecture.json";
import glossaryJson from "./glossary.json";
import regionsJson from "./regions.json";
import starterIssuesJson from "./starter-issues.json";
import workflowJson from "./workflow.json";

const REQUIRED_TERMS = [
  "pipeline",
  "receiver",
  "processor",
  "exporter",
  "extension",
  "connector",
  "consumer",
  "signal",
  "otlp",
  "stability",
  "distribution",
  "confmap",
  "factory",
  "mdatagen",
  "metadata-yaml",
  "scraper",
  "feature-gate",
  "capability",
  "codeowners",
  "chloggen",
  "component-status",
  "testbed",
  "goleak",
  "config-schema",
  "distribution-membership",
] as const;

const REQUIRED_ARCH_REGIONS = [
  "region.confmap",
  "region.internal",
  "region.pkg",
  "region.cmd",
  "region.config",
  "region.testbed",
  "region.docs",
  "region.chloggen",
] as const;

const COMPONENTS_SNAPSHOT = fileURLToPath(
  new URL("../atlas/public/data/components.json", import.meta.url),
);

const regions = Regions.parse(regionsJson);
const glossary = Glossary.parse(glossaryJson);
const workflow = Workflow.parse(workflowJson);
const architecture = Architecture.parse(architectureJson);
const starterIssues = StarterIssues.parse(starterIssuesJson);
const anchors = anchorIds(regions);

function expectKnownAnchor(anchor: string, owner: string) {
  expect(anchors.has(anchor), `${owner} references unknown anchor ${anchor}`).toBe(true);
}

describe("content files parse against their schemas", () => {
  it("every file is stamped with the current content schema version", () => {
    for (const file of [regions, glossary, workflow, architecture, starterIssues]) {
      expect(file.schema_version).toBe(CONTENT_SCHEMA_VERSION);
    }
  });

  it("regions.json registers the five views", () => {
    expect(regions.views.map((view) => view.id)).toEqual([
      "view.catalog",
      "view.pipeline",
      "view.architecture",
      "view.workflow",
      "view.glossary",
    ]);
    expect(regions.views.map((view) => view.route)).toEqual([
      "#/catalog",
      "#/pipeline",
      "#/architecture",
      "#/workflow",
      "#/glossary",
    ]);
  });

  it("every region anchor id is unique and points at a registered view", () => {
    const ids = [...regions.views, ...regions.regions].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const viewIds = new Set(regions.views.map((view) => view.id));
    for (const region of regions.regions) {
      if (region.view !== undefined) {
        expect(viewIds.has(region.view), `${region.id} points at unknown ${region.view}`).toBe(
          true,
        );
      }
    }
  });

  it("glossary ships at least 30 terms and every required term", () => {
    expect(glossary.terms.length).toBeGreaterThanOrEqual(GLOSSARY_MIN_TERMS);
    const ids = new Set(glossary.terms.map((term) => term.id));
    for (const required of REQUIRED_TERMS) {
      expect(ids.has(required), `missing required term ${required}`).toBe(true);
    }
    expect(new Set(glossary.terms.map((term) => term.term)).size).toBe(glossary.terms.length);
  });

  it("architecture covers the eight required regions", () => {
    const anchorsDefined = new Set(architecture.regions.map((region) => region.anchor));
    for (const required of REQUIRED_ARCH_REGIONS) {
      expect(anchorsDefined.has(required), `missing architecture region ${required}`).toBe(true);
    }
    expect(new Set([...anchorsDefined]).size).toBe(architecture.regions.length);
  });

  it("workflow steps are an ordered sequence with a file anchor each", () => {
    const orders = workflow.steps.map((step) => step.order).sort((a, b) => a - b);
    expect(orders).toEqual(workflow.steps.map((_, index) => index + 1));
    for (const step of workflow.steps) {
      expect(step.file_anchor.length, `${step.id} has no file_anchor`).toBeGreaterThan(0);
    }
    expect(new Set(workflow.steps.map((step) => step.id)).size).toBe(workflow.steps.length);
  });

  it("starter issues parse with one target each", () => {
    expect(starterIssues.issues.length).toBeGreaterThan(0);
    for (const issue of starterIssues.issues) {
      if (issue.kind === "component") expect(issue.component_id).toContain("/");
      else expect(issue.issue_url).toMatch(/^https:\/\/github\.com\//);
    }
  });
});

describe("anchors resolve against regions.json", () => {
  it("glossary terms anchor on a registered region or view", () => {
    for (const term of glossary.terms) expectKnownAnchor(term.anchor, `term ${term.id}`);
  });

  it("workflow stops anchor on a registered region or view", () => {
    for (const step of workflow.steps) expectKnownAnchor(step.anchor, `step ${step.id}`);
  });

  it("architecture regions anchor on a registered region or view", () => {
    for (const region of architecture.regions) {
      expectKnownAnchor(region.anchor, `architecture ${region.anchor}`);
    }
  });

  it("starter issues anchor on a registered region or view", () => {
    for (const issue of starterIssues.issues)
      expectKnownAnchor(issue.anchor, `starter ${issue.id}`);
  });

  it("region anchors cover every architecture, glossary and workflow place", () => {
    const regionIds = new Set(regions.regions.map((region) => region.id));
    for (const required of REQUIRED_ARCH_REGIONS) {
      expect(regionIds.has(required), `regions.json is missing ${required}`).toBe(true);
    }
  });

  it("workflow file anchors point at the region's own path", () => {
    const regionsById = new Map(regions.regions.map((region) => [region.id, region]));
    for (const step of workflow.steps) {
      const region = regionsById.get(step.anchor);
      expect(region, `${step.id} points at unknown region ${step.anchor}`).toBeDefined();
      if (region === undefined || region.path === undefined) continue; // concept regions
      if (region.path.endsWith("/")) {
        expect(
          step.file_anchor.startsWith(region.path),
          `${step.id} is outside ${region.path}`,
        ).toBe(true);
      } else {
        expect(step.file_anchor, `${step.id} disagrees with ${region.path}`).toBe(region.path);
      }
    }
  });

  it("contribUrl distinguishes directories from files", () => {
    expect(contribUrl("receiver/")).toBe(
      "https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/receiver",
    );
    expect(contribUrl("CONTRIBUTING.md")).toBe(
      "https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/CONTRIBUTING.md",
    );
  });
});

describe("cross references between content files", () => {
  it("glossary related ids point at other terms", () => {
    const ids = new Set(glossary.terms.map((term) => term.id));
    for (const term of glossary.terms) {
      for (const related of term.related) {
        expect(ids.has(related), `${term.id} relates to unknown term ${related}`).toBe(true);
      }
    }
  });

  it("architecture cross references terms and workflow stops", () => {
    const termIds = new Set(glossary.terms.map((term) => term.id));
    const stepIds = new Set(workflow.steps.map((step) => step.id));
    for (const region of architecture.regions) {
      for (const term of region.related_terms) {
        expect(termIds.has(term), `${region.anchor} relates to unknown term ${term}`).toBe(true);
      }
      for (const step of region.workflow_steps) {
        expect(stepIds.has(step), `${region.anchor} links unknown step ${step}`).toBe(true);
      }
    }
  });

  it("every content file references only paths under the contrib repo root", () => {
    const paths = [
      ...regions.regions.flatMap((region) => (region.path === undefined ? [] : [region.path])),
      ...glossary.terms.map((term) => term.source.path),
      ...workflow.steps.map((step) => step.file_anchor),
      ...architecture.regions.flatMap((region) => region.paths),
    ];
    expect(paths.length).toBeGreaterThan(40);
    for (const path of paths) {
      expect(path, `${path} escapes the repository`).not.toMatch(/(^|\/)\.\.(\/|$)/);
      expect(path).not.toMatch(/^https?:/);
    }
  });
});

describe("starter component ids", () => {
  it("resolve against the extracted snapshot when it exists", () => {
    if (!existsSync(COMPONENTS_SNAPSHOT)) return;
    const snapshot = JSON.parse(readFileSync(COMPONENTS_SNAPSHOT, "utf8")) as {
      components: { id: string }[];
    };
    const componentIds = new Set(snapshot.components.map((component) => component.id));
    const picks = starterIssues.issues.filter((issue) => issue.kind === "component");
    expect(picks.length).toBeGreaterThan(0);
    for (const pick of picks) {
      if (pick.kind !== "component") continue;
      expect(
        componentIds.has(pick.component_id),
        `${pick.id} points at unknown component ${pick.component_id}`,
      ).toBe(true);
    }
  });
});
