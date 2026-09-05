---
trigger: always_on
description: Enforce Rule 1 - Always work on branch before commit
---

# Git Workflow Rules

## Rule 1: Always work on branch before commit
- **NEVER** commit directly to `main` or `master`.
- Always create or switch to a dedicated feature, fix, or task branch (e.g. `feature/...`, `dev`, etc.) before making commits.
- Before committing any changes, check the active branch using `git branch --show-current`.
