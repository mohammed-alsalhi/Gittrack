// @ts-nocheck
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const execFileAsync = promisify(execFile);
const STALE_THRESHOLD_DAYS = 30;
const GITHUB_REPO_LIMIT_PER_OWNER = 1000;

export default defineConfig({
  plugins: [react(), localGitApiPlugin(), githubCliAuthApiPlugin()],
});

function localGitApiPlugin() {
  return {
    name: "gittrack-local-git-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://gittrack.local");
        if (!url.pathname.startsWith("/api/local-git")) {
          next();
          return;
        }

        try {
          if (url.pathname === "/api/local-git/default") {
            sendJson(res, 200, { repoPath: process.cwd() });
            return;
          }

          if (url.pathname !== "/api/local-git/summary") {
            sendJson(res, 404, { error: "Unknown local git endpoint." });
            return;
          }

          const requestedPath = url.searchParams.get("path") ?? process.cwd();
          const summary = await buildLocalGitSummary(requestedPath);
          sendJson(res, 200, summary);
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "Unable to read local git repository.",
          });
        }
      });
    },
  };
}

function githubCliAuthApiPlugin() {
  return {
    name: "gittrack-github-cli-auth-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? "/", "http://gittrack.local");
        if (url.pathname !== "/api/github/cli-auth") {
          next();
          return;
        }

        try {
          const token = (await runCommand("gh", ["auth", "token"])).trim();
          if (!token) throw new Error("GitHub CLI did not return a token.");

          const login = (await runCommand("gh", ["api", "user", "--jq", ".login"])).trim();
          const orgOutput = await optionalCommand("gh", ["api", "user/orgs", "--paginate", "--jq", ".[].login"], "");
          const orgs = orgOutput.split(/\r?\n/).map((org) => org.trim()).filter(Boolean);
          const owners = [...new Set([login, ...orgs].filter(Boolean))];
          const ownerResults = await Promise.all(owners.map((owner) => listReposForOwner(owner)));
          const reposBySlug = new Map();
          const warnings = [];

          ownerResults.forEach((result) => {
            if (result.error) {
              warnings.push({
                owner: result.owner,
                error: result.error,
              });
              return;
            }

            if (result.warning) {
              warnings.push({
                owner: result.owner,
                error: result.warning,
              });
            }

            result.repos
              .filter((repo) => !repo.isArchived && repo.nameWithOwner)
              .forEach((repo) => {
                reposBySlug.set(repo.nameWithOwner, repo);
              });
          });

          const repos = [...reposBySlug.values()]
            .sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))
            .map((repo) => repo.nameWithOwner);

          sendJson(res, 200, {
            login,
            token,
            orgs,
            owners,
            repos,
            repoLimitPerOwner: GITHUB_REPO_LIMIT_PER_OWNER,
            warnings,
            githubUrl: "https://github.com",
            repositoryUrl: `https://github.com/${login}?tab=repositories`,
            organizationUrl: "https://github.com/settings/organizations",
            source: "gh-cli",
          });
        } catch (error) {
          sendJson(res, 401, {
            error:
              "GitHub CLI is not authenticated. Run `gh auth login -h github.com` in your terminal, then try again.",
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      });
    },
  };
}

async function listReposForOwner(owner) {
  try {
    const repoJson = await runCommand("gh", [
      "repo",
      "list",
      owner,
      "--limit",
      String(GITHUB_REPO_LIMIT_PER_OWNER),
      "--json",
      "nameWithOwner,isArchived,isPrivate,updatedAt,url",
    ]);

    const repos = JSON.parse(repoJson);

    return {
      owner,
      repos,
      warning: repos.length >= GITHUB_REPO_LIMIT_PER_OWNER
        ? `Reached the ${GITHUB_REPO_LIMIT_PER_OWNER} repo import limit for this owner. Add additional repos manually if needed.`
        : undefined,
    };
  } catch (error) {
    return {
      owner,
      repos: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function buildLocalGitSummary(inputPath) {
  const repoPath = resolveRepoPath(inputPath);
  const root = await git(repoPath, ["rev-parse", "--show-toplevel"]);
  const currentBranch = await optionalGit(root, ["branch", "--show-current"], "detached");
  const status = await git(root, ["status", "--porcelain=v1", "--branch"]);
  const statusLines = status.split(/\r?\n/).filter(Boolean);
  const changeLines = statusLines.slice(1);
  const remoteHead = await optionalGit(root, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], "");
  const defaultBranch = remoteHead.replace(/^origin\//, "") || currentBranch || "main";
  const remotes = parseRemotes(await optionalGit(root, ["remote", "-v"], ""));
  const localBranches = parseBranches(
    await optionalGit(root, [
      "for-each-ref",
      "--format=%(refname:short)%00%(objectname:short)%00%(committerdate:iso8601-strict)%00%(authorname)%00%(subject)%00%(upstream:short)%00%(upstream:track)%00%(worktreepath)%00%(HEAD)",
      "refs/heads",
    ], ""),
    "local",
  );
  const remoteBranches = parseBranches(
    await optionalGit(root, [
      "for-each-ref",
      "--format=%(refname:short)%00%(objectname:short)%00%(committerdate:iso8601-strict)%00%(authorname)%00%(subject)",
      "refs/remotes",
    ], ""),
    "remote",
  ).filter((branch) => !branch.name.endsWith("/HEAD"));
  const worktrees = await readWorktrees(root);
  const graphLines = (await optionalGit(root, ["log", "--graph", "--decorate", "--oneline", "--all", "--date-order", "-n", "80"], ""))
    .split(/\r?\n/)
    .filter(Boolean);

  return {
    repoPath,
    root,
    repoName: path.basename(root),
    currentBranch,
    defaultBranch,
    generatedAt: new Date().toISOString(),
    statusLine: statusLines[0] ?? "",
    isDirty: changeLines.length > 0,
    dirtyCount: changeLines.length,
    stagedCount: changeLines.filter((line) => line[0] !== " " && line[0] !== "?").length,
    unstagedCount: changeLines.filter((line) => line[1] !== " " && line[0] !== "?").length,
    untrackedCount: changeLines.filter((line) => line.startsWith("??")).length,
    staleThresholdDays: STALE_THRESHOLD_DAYS,
    remotes,
    localBranches,
    remoteBranches,
    worktrees,
    graphLines,
  };
}

function resolveRepoPath(inputPath) {
  const trimmed = String(inputPath || process.cwd()).trim();
  if (!trimmed || trimmed === ".") return process.cwd();
  if (trimmed === "~") return process.env.HOME ?? process.cwd();
  if (trimmed.startsWith("~/")) return path.join(process.env.HOME ?? process.cwd(), trimmed.slice(2));
  return path.resolve(trimmed);
}

async function git(repoPath, args) {
  return runCommand("git", ["-C", repoPath, ...args]);
}

async function runCommand(command, args) {
  const { stdout } = await execFileAsync(command, args, {
    maxBuffer: 1024 * 1024 * 5,
    timeout: 15000,
  });
  return stdout.trimEnd();
}

async function optionalCommand(command, args, fallback) {
  try {
    return await runCommand(command, args);
  } catch {
    return fallback;
  }
}

async function optionalGit(repoPath, args, fallback) {
  try {
    return await git(repoPath, args);
  } catch {
    return fallback;
  }
}

function parseBranches(output, kind) {
  if (!output.trim()) return [];

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [name, sha, updatedAt, author, subject, upstream = "", track = "", worktreePath = "", head = ""] = line.split("\0");
      const parsedTrack = parseTrack(track);
      const ageDays = daysSince(updatedAt);
      const remote = kind === "remote" ? name.split("/")[0] : upstream.split("/")[0] || undefined;

      return {
        name,
        kind,
        sha,
        updatedAt,
        ageDays,
        author,
        subject,
        upstream: upstream || undefined,
        remote,
        ahead: parsedTrack.ahead,
        behind: parsedTrack.behind,
        gone: parsedTrack.gone,
        current: head === "*",
        stale: kind === "remote"
          ? ageDays >= STALE_THRESHOLD_DAYS
          : head !== "*" && (parsedTrack.gone || ageDays >= STALE_THRESHOLD_DAYS),
        worktreePath: worktreePath || undefined,
      };
    })
    .sort((a, b) => Number(b.current) - Number(a.current) || Number(b.stale) - Number(a.stale) || b.ageDays - a.ageDays);
}

function parseTrack(track) {
  const ahead = Number(track.match(/ahead (\d+)/)?.[1] ?? 0);
  const behind = Number(track.match(/behind (\d+)/)?.[1] ?? 0);
  return {
    ahead,
    behind,
    gone: /\bgone\b/.test(track),
  };
}

function parseRemotes(output) {
  const remotes = new Map();
  output.split(/\r?\n/).forEach((line) => {
    const [name, url, direction] = line.trim().split(/\s+/);
    if (!name || !url) return;
    const remote = remotes.get(name) ?? { name };
    if (direction === "(fetch)") remote.fetchUrl = url;
    if (direction === "(push)") remote.pushUrl = url;
    remotes.set(name, remote);
  });
  return Array.from(remotes.values());
}

async function readWorktrees(root) {
  const output = await optionalGit(root, ["worktree", "list", "--porcelain"], "");
  const groups = [];
  let current;

  output.split(/\r?\n/).forEach((line) => {
    if (!line.trim()) {
      if (current) groups.push(current);
      current = undefined;
      return;
    }

    const [key, ...rest] = line.split(" ");
    if (key === "worktree") current = { path: rest.join(" ") };
    else if (current && key === "HEAD") current.head = rest.join(" ");
    else if (current && key === "branch") current.branch = rest.join(" ").replace(/^refs\/heads\//, "");
    else if (current && key === "detached") current.detached = true;
    else if (current && key === "bare") current.bare = true;
  });
  if (current) groups.push(current);

  return Promise.all(groups.map(async (worktree) => {
    const status = await optionalGit(worktree.path, ["status", "--porcelain=v1"], "");
    const dirtyCount = status.split(/\r?\n/).filter(Boolean).length;
    const branchAge = await optionalGit(worktree.path, ["log", "-1", "--format=%cI"], "");
    return {
      path: worktree.path,
      branch: worktree.branch,
      head: worktree.head,
      detached: Boolean(worktree.detached),
      bare: Boolean(worktree.bare),
      clean: dirtyCount === 0,
      dirtyCount,
      stale: daysSince(branchAge) >= STALE_THRESHOLD_DAYS && worktree.path !== root,
    };
  }));
}

function daysSince(isoDate) {
  const timestamp = Date.parse(isoDate);
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86400000));
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}
