import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stableStringify } from "../lib/json";
import { extractRepo, markdownHeadings, missingWorkflowAnchors } from "./extract";

const CONTRIBUT = "github.com/open-telemetry/opentelemetry-collector-contrib";

const WORKFLOW_ANCHORS = [
  ".github/ISSUE_TEMPLATE/",
  "issue-triaging.md",
  "CONTRIBUTING.md",
  "docs/new-components.md",
  "docs/testing.md",
  "Makefile",
  ".chloggen/README.md",
  ".github/pull_request_template.md",
  ".github/CODEOWNERS",
];

const COMPONENT_IDS = ["receiver/foo", "receiver/bar", "extension/internal"];

const created: string[] = [];

function write(root: string, path: string, text: string): void {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

function fixtureRepo(): string {
  const root = mkdtempSync(join(tmpdir(), "otel-repo-"));
  created.push(root);
  write(root, ".git/config", "[core]\n");
  write(root, "go.mod", `module ${CONTRIBUT}\n\ngo 1.26.0\n`);
  write(
    root,
    "receiver/foo/go.mod",
    [
      `module ${CONTRIBUT}/receiver/foo`,
      "",
      "require (",
      `\t${CONTRIBUT}/receiver/bar v0.162.0`,
      `\t${CONTRIBUT}/pkg/ghost v0.162.0`,
      "\tgithub.com/pkg/errors v0.9.1",
      ")",
      "",
    ].join("\n"),
  );
  write(root, "receiver/bar/go.mod", `module ${CONTRIBUT}/receiver/bar\n\ngo 1.26.0\n`);
  write(root, "receiver/foo/factory.go", "package foo\n");
  write(root, "extension/internal/doc.go", "package internal\n");
  write(
    root,
    "CONTRIBUTING.md",
    "# How to Contribute\n\n## Before you start\n\n## Filing issues\n",
  );
  write(root, "issue-triaging.md", "# Issue triaging\n\n## Labels\n");
  write(root, "Makefile", "test:\n\tgo test ./...\n");
  write(root, "docs/testing.md", "# Testing\n\n## Unit tests\n");
  write(root, "docs/new-components.md", "# Creating new components\n\n## Checklist\n");
  write(root, ".chloggen/README.md", "# Changelog entries\n\n### Changelog folder\n");
  write(root, ".github/pull_request_template.md", "## Description\n");
  write(
    root,
    ".github/CODEOWNERS",
    ["* @approvers", "receiver/foo/ @alice", ".github/ISSUE_TEMPLATE/ @triage", ""].join("\n"),
  );
  write(root, ".github/ISSUE_TEMPLATE/bug.md", "---\nname: bug\n---\n");
  write(
    root,
    "distributions.yaml",
    ["- name: contrib", "  url: https://example.com/contrib", ""].join("\n"),
  );
  return root;
}

afterEach(() => {
  while (created.length > 0) {
    const path = created.pop();
    if (path !== undefined) rmSync(path, { recursive: true, force: true });
  }
});

describe("markdownHeadings", () => {
  it("collects ATX headings in order and ignores fenced code", () => {
    const text = [
      "# Title",
      "",
      "```bash",
      "# not a heading",
      "```",
      "",
      "## Real section",
      "### Deep heading ###",
      "## Bad [link](https://x) heading",
      "",
      "~~~",
      "# also not",
      "~~~",
    ].join("\n");
    expect(markdownHeadings(text)).toEqual([
      "Title",
      "Real section",
      "Deep heading",
      "Bad link heading",
    ]);
  });
});

describe("extractRepo", () => {
  it("builds a sorted module graph with component attribution", () => {
    const root = fixtureRepo();
    const { modules, warnings } = extractRepo(root, COMPONENT_IDS);
    expect(modules.map((module) => module.path)).toEqual(["", "receiver/bar", "receiver/foo"]);
    expect(modules.map((module) => module.module)).toEqual([
      CONTRIBUT,
      `${CONTRIBUT}/receiver/bar`,
      `${CONTRIBUT}/receiver/foo`,
    ]);
    expect(modules[0].components).toEqual(["extension/internal"]);
    expect(modules[2].components).toEqual(["receiver/foo"]);
    expect(modules[2].requires).toEqual([`${CONTRIBUT}/pkg/ghost`, `${CONTRIBUT}/receiver/bar`]);
    expect(warnings.some((warning) => warning.includes("pkg/ghost"))).toBe(true);
  });

  it("keeps component attribution sorted and deterministic", () => {
    const root = fixtureRepo();
    const first = extractRepo(root, COMPONENT_IDS);
    const second = extractRepo(root, [...COMPONENT_IDS].reverse());
    expect(first.modules).toEqual(second.modules);
    expect(stableStringify(first.repofiles)).toBe(stableStringify(second.repofiles));
  });

  it("indexes checkout-derived files with owners, headings and distributions", () => {
    const root = fixtureRepo();
    const { repofiles, warnings } = extractRepo(root, COMPONENT_IDS);
    const { files } = repofiles;

    for (const anchor of WORKFLOW_ANCHORS) {
      expect(Object.keys(files)).toContain(anchor);
    }
    expect(missingWorkflowAnchors(files, WORKFLOW_ANCHORS)).toEqual([]);
    expect(missingWorkflowAnchors(files, [...WORKFLOW_ANCHORS, "docs/missing.md"])).toEqual([
      "docs/missing.md",
    ]);

    expect(files["docs/testing.md"]).toEqual({
      kind: "file",
      title: "Testing",
      headings: ["Testing", "Unit tests"],
      owners: ["@approvers"],
    });
    expect(files[".github/ISSUE_TEMPLATE/"]).toEqual({
      kind: "dir",
      headings: [],
      owners: ["@triage"],
    });
    expect(files["receiver/"]?.kind).toBe("dir");
    expect(files["go.mod"]?.kind).toBe("file");
    expect(files[".git/"]).toBeUndefined();
    expect(files["CHANGELOG.md"]).toBeUndefined();

    expect(repofiles.distributions).toEqual([
      { name: "contrib", url: "https://example.com/contrib" },
    ]);
    expect(repofiles.codeowners.length).toBe(3);
    expect(warnings.filter((warning) => !warning.includes("required module"))).toEqual([]);
  });
});
