import { FormEvent, useEffect, useRef, useState } from "react";
import { ExternalLink, Github, KeyRound, X } from "lucide-react";
import { TrackerConfig } from "../types";

interface SettingsDialogProps {
  open: boolean;
  config: TrackerConfig;
  onClose: () => void;
  onSave: (config: TrackerConfig, refresh: boolean) => void;
}

interface GitHubCliScope {
  login: string;
  orgs: string[];
  owners: string[];
  repoCount: number;
  repoLimitPerOwner?: number;
  warnings: Array<{ owner: string; error: string }>;
  repositoryUrl?: string;
  organizationUrl?: string;
}

const GITHUB_LINKS = [
  { href: "https://github.com/?tab=repositories", label: "GitHub repos" },
  { href: "https://github.com/settings/personal-access-tokens", label: "Tokens" },
  { href: "https://github.com/settings/organizations", label: "Org access" },
];

export function SettingsDialog({ open, config, onClose, onSave }: SettingsDialogProps) {
  const [token, setToken] = useState(config.token);
  const [repos, setRepos] = useState(config.repoSlugs.join("\n"));
  const [cliLoading, setCliLoading] = useState(false);
  const [cliError, setCliError] = useState<string | null>(null);
  const [cliScope, setCliScope] = useState<GitHubCliScope | null>(null);
  const initializedOpenDialog = useRef(false);

  useEffect(() => {
    if (!open) {
      initializedOpenDialog.current = false;
      return;
    }

    if (initializedOpenDialog.current) return;
    initializedOpenDialog.current = true;
    setToken(config.token);
    setRepos(config.repoSlugs.join("\n"));
    setCliError(null);
    setCliScope(null);
  }, [config, open]);

  if (!open) return null;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(
      {
        token: token.trim(),
        repoSlugs: repos
          .split(/[\n,]/)
          .map((repo) => repo.trim())
          .filter(Boolean),
      },
      true,
    );
  };

  const connectWithGitHubCli = async () => {
    setCliLoading(true);
    setCliError(null);

    try {
      const response = await fetch("/api/github/cli-auth");
      const payload = await response.json().catch(() => undefined);

      if (!response.ok) {
        throw new Error(payload?.error ?? "GitHub CLI auth failed.");
      }

      const nextConfig = {
        token: String(payload.token ?? ""),
        repoSlugs: Array.isArray(payload.repos) ? payload.repos.filter((repo: unknown): repo is string => typeof repo === "string") : [],
      };
      setToken(nextConfig.token);
      setRepos(nextConfig.repoSlugs.join("\n"));
      setCliScope({
        login: String(payload.login ?? "unknown"),
        orgs: Array.isArray(payload.orgs) ? payload.orgs.filter((org: unknown): org is string => typeof org === "string") : [],
        owners: Array.isArray(payload.owners) ? payload.owners.filter((owner: unknown): owner is string => typeof owner === "string") : [],
        repoCount: nextConfig.repoSlugs.length,
        repoLimitPerOwner: typeof payload.repoLimitPerOwner === "number" ? payload.repoLimitPerOwner : undefined,
        warnings: Array.isArray(payload.warnings)
          ? payload.warnings.filter(
              (warning: unknown): warning is { owner: string; error: string } =>
                Boolean(
                  warning &&
                    typeof warning === "object" &&
                    "owner" in warning &&
                    "error" in warning &&
                    typeof warning.owner === "string" &&
                    typeof warning.error === "string",
                ),
            )
          : [],
        repositoryUrl: typeof payload.repositoryUrl === "string" ? payload.repositoryUrl : undefined,
        organizationUrl: typeof payload.organizationUrl === "string" ? payload.organizationUrl : undefined,
      });
      onSave(nextConfig, true);
    } catch (caught) {
      setCliError(caught instanceof Error ? caught.message : "GitHub CLI auth failed.");
    } finally {
      setCliLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="settings-dialog" onSubmit={submit}>
        <div className="dialog-head">
          <div>
            <Github size={22} />
            <h2>GitHub Settings</h2>
          </div>
          <button type="button" className="icon-button small" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <label className="field">
          <span>
            <KeyRound size={15} />
            Token
          </span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="github_pat_..."
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Repositories</span>
          <textarea
            value={repos}
            onChange={(event) => setRepos(event.target.value)}
            placeholder={"owner/repo\nowner/another-repo"}
            rows={6}
          />
        </label>

        <p className="dialog-note">
          Saved locally in this browser. GitHub CLI import uses your signed-in gh account and loads personal plus org repositories.
        </p>
        <div className="dialog-link-strip" aria-label="GitHub links">
          {GITHUB_LINKS.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
              <ExternalLink size={13} />
              {link.label}
            </a>
          ))}
        </div>
        {cliScope && (
          <div className="dialog-cli-scope">
            <strong>{cliScope.repoCount} repos loaded from GitHub CLI</strong>
            <span>
              @{cliScope.login}
              {cliScope.orgs.length ? ` plus ${cliScope.orgs.length} ${cliScope.orgs.length === 1 ? "org" : "orgs"}` : ""}
              {cliScope.repoLimitPerOwner ? ` - limit ${cliScope.repoLimitPerOwner} per owner` : ""}
            </span>
            {cliScope.warnings.length > 0 && (
              <small>
                {cliScope.warnings.length} owner {cliScope.warnings.length === 1 ? "issue needs" : "issues need"} GitHub access, SSO authorization, or manual repo entry.
              </small>
            )}
            <div>
              <a href={cliScope.repositoryUrl ?? "https://github.com/?tab=repositories"} target="_blank" rel="noreferrer">
                <ExternalLink size={13} />
                Your GitHub repos
              </a>
              <a href={cliScope.organizationUrl ?? "https://github.com/settings/organizations"} target="_blank" rel="noreferrer">
                <ExternalLink size={13} />
                GitHub org access
              </a>
            </div>
          </div>
        )}
        {cliError && <p className="dialog-error">{cliError}</p>}

        <div className="dialog-actions">
          <button type="button" className="control-button" onClick={() => onSave(config, false)}>
            Use sample data
          </button>
          <button type="button" className="control-button" onClick={connectWithGitHubCli} disabled={cliLoading}>
            {cliLoading ? "Checking gh..." : "Use GitHub CLI"}
          </button>
          <button type="submit" className="primary-action">
            Save and refresh
          </button>
        </div>
      </form>
    </div>
  );
}
