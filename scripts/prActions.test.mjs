import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { transform } from "esbuild";

const source = await readFile(new URL("../src/lib/prActions.ts", import.meta.url), "utf8");
const compiled = await transform(source, {
  format: "esm",
  loader: "ts",
  sourcemap: "inline",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled.code).toString("base64")}`;
const { findBranchForPullRequest, getPullRequestActionState } = await import(moduleUrl);

const basePr = {
  id: "repo#1",
  repo: "owner/repo",
  number: 1,
  title: "Ready PR",
  branch: "feature/ready",
  base: "main",
  state: "approved",
  isDraft: false,
  author: { login: "mo" },
  reviewers: [],
  reviewEvents: [],
  codex: {
    exists: true,
    reaction: "thumbs_up",
    statusText: "Codex approved",
    events: [],
  },
  ci: "success",
  ciSummary: "All checks passed",
  labels: [],
  createdAt: "2026-06-01T00:00:00.000Z",
  updatedAt: "2026-06-01T00:00:00.000Z",
};

const cleanBranch = {
  id: "owner/repo:feature/ready",
  repo: "owner/repo",
  name: "feature/ready",
  health: "ahead",
  ahead: 2,
  behind: 0,
  updatedAt: "2026-06-01T00:00:00.000Z",
  pullRequestNumber: 1,
};

const readyState = getPullRequestActionState(basePr, cleanBranch, undefined);
assert.equal(readyState.canMarkReady, true);
assert.equal(readyState.canQueueMerge, true);
assert.equal(readyState.canPromoteCodex, false);

const draftState = getPullRequestActionState({ ...basePr, state: "draft", isDraft: true }, cleanBranch, undefined);
assert.equal(draftState.canQueueMerge, false);
assert.match(draftState.blockedReason ?? "", /Draft/);

const failingState = getPullRequestActionState({ ...basePr, ci: "failure" }, cleanBranch, undefined);
assert.equal(failingState.canMarkReady, false);
assert.match(failingState.blockedReason ?? "", /CI/);

const divergedState = getPullRequestActionState(
  basePr,
  { ...cleanBranch, health: "diverged", behind: 3 },
  undefined,
);
assert.equal(divergedState.canQueueMerge, false);
assert.match(divergedState.blockedReason ?? "", /diverged/);

const unknownBranchState = getPullRequestActionState(basePr, undefined, undefined);
assert.equal(unknownBranchState.canQueueMerge, false);
assert.match(unknownBranchState.blockedReason ?? "", /unknown/);

assert.equal(findBranchForPullRequest([cleanBranch], basePr)?.id, cleanBranch.id);

console.log("prActions tests passed");
