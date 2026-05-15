# Codex App Automation: AI Daily Digest

Use this as a standalone project automation for `/Users/dongw/Documents/OSS/ai-daily-digest`.

Suggested schedule: daily at 7:30 AM America/Los_Angeles.

Custom cron:

```cron
30 7 * * *
```

Recommended run mode: local project, not a worktree. This automation only writes generated digest files under `output/`, and local mode keeps the daily report in the main checkout.

Automation prompt:

```text
Run the AI Daily Digest automation for this project.

Use the existing saved digest configuration at ~/.hn-daily-digest/config.json. Do not print or expose API keys.

Run exactly this command from the project root:

/Users/dongw/.bun/bin/bun scripts/run-digest-automation.ts

After it completes, inspect output/latest-ai-daily-digest.json and output/latest-ai-daily-digest.md.

Report only:
- whether the run succeeded or failed
- the generated report path
- selected article count and failed-feed count, if visible from the command output or report
- the top 3 article titles, if present
- any action needed from me

Do not edit source files, do not commit, and do not modify anything outside output/.
If the command fails, retry once only if the failure looks transient. Otherwise report the error and stop.
```

Before enabling the schedule, test once manually in a normal Codex thread with:

```text
Use /Users/dongw/Documents/OSS/ai-daily-digest as the project and run:
/Users/dongw/.bun/bin/bun scripts/run-digest-automation.ts --check-config
```
