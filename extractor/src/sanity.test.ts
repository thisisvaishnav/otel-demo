import type { Component, ModuleDep, RepoFilesData } from "@otel-demo/schema";
import { describe, expect, it } from "vitest";
import { stableStringify } from "./lib/json";
import {
  MAX_FILE_BYTES,
  MAX_TOTAL_BYTES,
  MIN_MODULE_DEPS,
  sanityComponents,
  sanityFiles,
  sanityRepo,
} from "./sanity";

function component(id: string, className: Component["class"] = "receiver"): Component {
  return {
    id,
    class: className,
    type: id.split("/")[1]?.replace(/receiver$/, "") ?? id,
    display_name: id,
    description: "",
    signals: { metrics: "beta" },
    distributions: ["contrib"],
    codeowners: { active: ["alice"], emeritus: [], seeking_new: false },
    feature_gates: [],
    source_url: `https://example.com/${id}`,
    status_quality: "metadata",
  };
}

function population(): Component[] {
  const classes: Component["class"][] = [
    "receiver",
    "processor",
    "exporter",
    "extension",
    "connector",
    "scraper",
  ];
  const out: Component[] = [];
  for (const className of classes) {
    for (let index = 0; index < 34; index += 1) {
      out.push(component(`${className}/${className}${index}`, className));
    }
  }
  return out;
}

describe("stableStringify", () => {
  it("is key-order independent", () => {
    const a = { b: 1, a: [{ y: 1, x: 2 }] };
    const b = { a: [{ x: 2, y: 1 }], b: 1 };
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it("ends with a newline", () => {
    expect(stableStringify({})).toBe("{}\n");
  });
});

describe("sanityComponents", () => {
  it("accepts a populated snapshot", () => {
    expect(sanityComponents(population())).toEqual([]);
  });

  it("rejects snapshots below the component floor", () => {
    const violations = sanityComponents(population().slice(0, 50));
    expect(violations.some((violation) => violation.includes("expected >= 200"))).toBe(true);
  });

  it("rejects a missing class", () => {
    const withoutExporters = population().filter((entry) => entry.class !== "exporter");
    const violations = sanityComponents(withoutExporters);
    expect(violations.some((violation) => violation.includes('"exporter"'))).toBe(true);
  });

  it("rejects duplicate ids", () => {
    const withDuplicate = [...population(), component("receiver/receiver0")];
    expect(
      sanityComponents(withDuplicate).some((violation) => violation.includes("duplicate")),
    ).toBe(true);
  });
});

describe("sanityFiles", () => {
  it("accepts files inside the budget", () => {
    expect(sanityFiles([{ name: "components.json", bytes: 1000 }])).toEqual([]);
  });

  it("rejects a file over the per-file budget", () => {
    const violations = sanityFiles([{ name: "components.json", bytes: MAX_FILE_BYTES }]);
    expect(violations).toHaveLength(1);
  });

  it("rejects a total over the aggregate budget", () => {
    const violations = sanityFiles([
      { name: "a.json", bytes: MAX_TOTAL_BYTES - 10 },
      { name: "b.json", bytes: 20 },
    ]);
    expect(violations.some((violation) => violation.includes("data total"))).toBe(true);
  });
});

function moduleDep(path: string): ModuleDep {
  return {
    path,
    module: `example.com/${path === "" ? "root" : path}`,
    requires: [],
    components: [],
  };
}

function moduledeps(): ModuleDep[] {
  const out: ModuleDep[] = [moduleDep("")];
  for (let index = 0; index < MIN_MODULE_DEPS; index += 1) {
    out.push(moduleDep(`receiver/receiver${index}`));
  }
  return out;
}

function repofiles(): RepoFilesData {
  return {
    files: { Makefile: { kind: "file", headings: [], owners: ["@approvers"] } },
    codeowners: [{ pattern: "*", owners: ["@approvers"] }],
    distributions: [{ name: "contrib", url: "https://example.com/contrib" }],
  };
}

describe("sanityRepo", () => {
  it("accepts a populated repo snapshot", () => {
    expect(sanityRepo(moduledeps(), repofiles())).toEqual([]);
  });

  it("rejects a module graph below the floor", () => {
    const violations = sanityRepo(moduledeps().slice(0, 4), repofiles());
    expect(violations.some((violation) => violation.includes("expected >= 10"))).toBe(true);
  });

  it("rejects duplicate module paths", () => {
    const violations = sanityRepo([...moduledeps(), moduleDep("receiver/receiver0")], repofiles());
    expect(violations.some((violation) => violation.includes("duplicate"))).toBe(true);
  });

  it("rejects empty owner and distribution lists", () => {
    const empty = { ...repofiles(), codeowners: [], distributions: [] };
    const violations = sanityRepo(moduledeps(), empty);
    expect(violations).toHaveLength(2);
  });
});
