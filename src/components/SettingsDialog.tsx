import { FormEvent, useEffect, useState } from "react";
import { Github, KeyRound, X } from "lucide-react";
import { TrackerConfig } from "../types";

interface SettingsDialogProps {
  open: boolean;
  config: TrackerConfig;
  onClose: () => void;
  onSave: (config: TrackerConfig, refresh: boolean) => void;
}

export function SettingsDialog({ open, config, onClose, onSave }: SettingsDialogProps) {
  const [token, setToken] = useState(config.token);
  const [repos, setRepos] = useState(config.repoSlugs.join("\n"));
  const [cliLoading, setCliLoading] = useState(false);
  const [cliError, setCliError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setToken(config.token);
    setRepos(config.repoSlugs.join("\n"));
    setCliError(null);
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

        <p className="dialog-note">Saved locally in this browser. GitHub CLI auth uses your local `gh` login and loads up to 30 recent repos.</p>
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
