# Project Guidelines & Rules

## Git Workflow Rules

### Rule 1: Always work on branch before commit
- **NEVER** commit directly to `main` or `master`.
- Always create or switch to a dedicated feature or task branch (e.g., `git checkout -b feature/<name>` or `git checkout -b dev`) before making any commits.
- Always check the current branch using `git branch --show-current` or `git status` before executing `git commit`.
- Submit changes to `main` via pull requests or branch merges.
