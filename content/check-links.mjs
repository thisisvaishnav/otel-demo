#!/usr/bin/env node
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);
const OWNER = "open-telemetry";
const REPO = "opentelemetry-collector-contrib";
const CONCURRENCY = 8;

const read = (name) => JSON.parse(readFileSync(new URL(`./${name}`, import.meta.url), "utf8"));

const regions = read("regions.json");
const glossary = read("glossary.json");
const workflow = read("workflow.json");
const architecture = read("architecture.json");
const starterIssues = read("starter-issues.json");

const paths = [
  ...regions.regions.flatMap((region) => (region.path === undefined ? [] : [region.path])),
  ...glossary.terms.map((term) => term.source.path),
  ...workflow.steps.map((step) => step.file_anchor),
  ...architecture.regions.flatMap((region) => region.paths),
];
const issues = starterIssues.issues
  .filter((issue) => issue.kind === "issue")
  .map((issue) => issue.issue_url);

const uniquePaths = [...new Set(paths)].sort();
const uniqueIssues = [...new Set(issues)].sort();

const detail = (error) =>
  String(error.stderr ?? error.message)
    .trim()
    .split("\n")
    .pop();

async function checkPath(path) {
  const target = path.replace(/\/$/, "");
  try {
    // files resolve to an object with a sha, directories to an array of entries.
    await run("gh", [
      "api",
      `repos/${OWNER}/${REPO}/contents/${target}`,
      "--jq",
      'if type == "object" then .sha else "dir" end',
    ]);
    return null;
  } catch (error) {
    return `${path}: ${detail(error)}`;
  }
}

async function checkIssue(url) {
  const number = url.split("/").pop();
  try {
    const { stdout } = await run("gh", [
      "api",
      `repos/${OWNER}/${REPO}/issues/${number}`,
      "--jq",
      ".state",
    ]);
    const state = stdout.trim().toLowerCase();
    return state === "open" ? null : `${url}: issue is ${state}`;
  } catch (error) {
    return `${url}: ${detail(error)}`;
  }
}

async function pool(items, worker) {
  const failures = [];
  let cursor = 0;
  const lanes = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      const failure = await worker(item);
      if (failure !== null) failures.push(failure);
    }
  });
  await Promise.all(lanes);
  return failures;
}

const [pathFailures, issueFailures] = await Promise.all([
  pool(uniquePaths, checkPath),
  pool(uniqueIssues, checkIssue),
]);

for (const failure of [...pathFailures, ...issueFailures]) console.error(`FAIL: ${failure}`);
console.log(
  `checked ${uniquePaths.length} file anchors and ${uniqueIssues.length} issue links against ${OWNER}/${REPO}`,
);
if (pathFailures.length + issueFailures.length > 0) process.exit(1);
console.log("link check OK");
