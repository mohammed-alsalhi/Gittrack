# Git Tracker

A personal GitHub dashboard for watching branches, pull requests, review state, CI, and Codex review signals.

## Run

```bash
npm install
npm run dev
```

Open the local Vite URL, then use settings to add `owner/repo` slugs and an optional GitHub token. Without settings, the app runs with sample data.

## Codex Signal

The PR inspector highlights whether a Codex review exists, whether it has an eyes reaction, a thumbs-up reaction, or a visible eyes-to-thumbs-up transition.
