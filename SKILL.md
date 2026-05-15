---
name: ai-daily-digest
description: "Fetches RSS feeds from curated technology blogs, uses AI to score and filter articles, and generates a daily Markdown digest with English titles, category grouping, trend highlights, Mermaid charts, and a tag cloud. Use when the user mentions daily digest, RSS digest, blog digest, AI blogs, tech news summary, or asks to run the digest skill."
---

# AI Daily Digest

Fetch recent posts from curated technology blogs, score and summarize them with AI, and generate a daily Markdown digest in English.

## Command

Run the daily digest generator.

Suggested user request:

```text
Run the ai-daily-digest skill
```

## Script Directory

All scripts live in this skill's `scripts/` directory.

Agent execution notes:

1. Set `SKILL_DIR` to the directory containing this `SKILL.md`.
2. Run `${SKILL_DIR}/scripts/digest.ts`.

| Script | Purpose |
|---|---|
| `scripts/digest.ts` | Main script for RSS fetching, AI scoring, summaries, and report generation |
| `scripts/run-digest-automation.ts` | Codex App automation wrapper that loads saved config and writes timestamped/latest reports |

## Persisted Configuration

Config path: `~/.hn-daily-digest/config.json`

Before running, the agent must check whether this file exists:

```bash
cat ~/.hn-daily-digest/config.json 2>/dev/null || echo "NO_CONFIG"
```

If the config exists and contains `anthropicApiKey`, ask whether to reuse it.

Config shape:

```json
{
  "anthropicApiKey": "",
  "anthropicModel": "claude-sonnet-4-6",
  "anthropicEffort": "xhigh",
  "anthropicMaxTokens": 100000,
  "anthropicBatch": true,
  "timeRange": 48,
  "topN": 25,
  "language": "en",
  "lastUsed": "2026-02-14T12:00:00Z"
}
```

## Interaction Flow

### Step 0: Check Saved Config

If saved config exists, present the last-used settings:

```text
Saved digest configuration found:

- Time range: ${config.timeRange} hours
- Selected articles: up to ${config.topN} after quality filtering
- Anthropic model: ${config.anthropicModel || 'claude-sonnet-4-6'}
- Anthropic effort: ${config.anthropicEffort || 'xhigh'}
- Anthropic batch mode: ${config.anthropicBatch === false ? 'off' : 'on'}
- Output language: English

Choose whether to reuse this configuration or reconfigure.
```

### Step 1: Collect Parameters

Collect these settings:

| Setting | Options | Default |
|---|---|---|
| Time range | 24 hours / 48 hours / 72 hours / 7 days | 48 hours |
| Selected articles | Up to 10 / 15 / 25 after quality filtering | 25 |
| Output language | English | English |

### Step 1b: AI API Key

If no saved key exists, ask for an Anthropic API key.

Anthropic key URL: https://console.anthropic.com/settings/keys

Optional fallback providers:

- `GEMINI_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_API_BASE`
- `OPENAI_MODEL`

### Step 2: Run Script

```bash
mkdir -p ./output

export ANTHROPIC_API_KEY="<key>"
export ANTHROPIC_MODEL="claude-sonnet-4-6"
export ANTHROPIC_EFFORT="xhigh"
export ANTHROPIC_MAX_TOKENS="100000"
export ANTHROPIC_BATCH="true"

# Optional fallbacks
export GEMINI_API_KEY="<fallback-key>"
export OPENAI_API_KEY="<fallback-key>"
export OPENAI_API_BASE="https://api.deepseek.com/v1"
export OPENAI_MODEL="deepseek-chat"

npx -y bun ${SKILL_DIR}/scripts/digest.ts \
  --hours <timeRange> \
  --top-n <topN> \
  --lang en \
  --output ./output/digest-$(date +%Y%m%d).md
```

### Step 2b: Save Config

```bash
mkdir -p ~/.hn-daily-digest
cat > ~/.hn-daily-digest/config.json << 'EOF'
{
  "anthropicApiKey": "<key>",
  "anthropicModel": "claude-sonnet-4-6",
  "anthropicEffort": "xhigh",
  "anthropicMaxTokens": 100000,
  "anthropicBatch": true,
  "timeRange": <hours>,
  "topN": <topN>,
  "language": "en",
  "lastUsed": "<ISO timestamp>"
}
EOF
chmod 600 ~/.hn-daily-digest/config.json
```

### Step 3: Show Result

On success, report:

- Report file path
- Summary stats: scanned feeds, fetched articles, recent articles, selected articles
- Top 3 preview with English titles and one-sentence summaries

### Codex App Automation

For scheduled Codex App runs, use the project automation assets in the repo:

- Prompt: `automation/codex-app-automation-prompt.md`
- Runner: `/Users/dongw/.bun/bin/bun scripts/run-digest-automation.ts`
- Readiness check: `/Users/dongw/.bun/bin/bun scripts/run-digest-automation.ts --check-config`
- Project rule: `.codex/rules/ai-daily-digest-automation.rules`

Use a standalone project automation in local project mode, not a worktree, so generated reports land under this repo's `output/` directory. Restart Codex after changing `.rules` files.

The generated Markdown report contains:

1. Highlights: a 3 to 5 sentence trend summary
2. Top reads: the top three articles with summary, reason, keyword tags, and each raw original link
3. Data overview: tables, Mermaid charts, plain-text keyword chart, and tag cloud
4. Failed feeds: unavailable, timed-out, blocked, or empty feeds skipped during the run
5. Category article lists grouped by AI/ML, AI infra, inference performance, CUDA kernels, PyTorch ecosystem, vLLM updates, security, tools/open source, opinion, and other, with each raw original link shown

Selection policy:

- Strongly prefer technical AI infrastructure, inference performance, CUDA/Triton kernels, PyTorch internals, vLLM, and production model-serving work.
- Treat the selected article count as a maximum, not a quota. Output fewer articles when fewer than the requested maximum clear the quality gate.
- Filter out general software engineering, policy/regulation/legal stories, broad opinion pieces, general security news, career/culture posts, and company drama.
- Include security only when it directly affects AI infrastructure, model serving, GPU runtimes, PyTorch, vLLM, or production ML systems.

On failure, show the error and likely cause, such as invalid API key, network access, or feed availability.

## Parameter Mapping

| Option | Script argument |
|---|---|
| 24 hours | `--hours 24` |
| 48 hours | `--hours 48` |
| 72 hours | `--hours 72` |
| 7 days | `--hours 168` |
| 10 articles | `--top-n 10` |
| 15 articles | `--top-n 15` |
| 25 articles | `--top-n 25` |
| English | `--lang en` |

## Requirements

- Bun runtime, available through `npx -y bun`
- At least one AI API key, preferably `ANTHROPIC_API_KEY`
- Optional: `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `ANTHROPIC_MAX_TOKENS`, `ANTHROPIC_BATCH`, `OPENAI_API_BASE`, `OPENAI_MODEL`
- Network access for RSS feeds and AI API calls

Default Anthropic settings use Claude Sonnet 4.6 with Message Batches enabled. Batch mode is asynchronous and can take longer than direct Messages API calls, but Anthropic prices batch requests at a 50% discount.

## Feed Sources

The feed list is based on Hacker News-popular technology blogs plus selected AI infrastructure and runtime sources. The full list is embedded in `scripts/digest.ts`.

Specialized AI runtime coverage includes vLLM, PyTorch, NVIDIA Developer Blog, CUDA For Fun, Tri Dao, Together AI, Runpod, Anyscale, Hugging Face, and SemiAnalysis sources.

## Troubleshooting

### "ANTHROPIC_API_KEY not set"

Set `ANTHROPIC_API_KEY` or configure a fallback provider.

### Anthropic quota or request failures

The script can fall back to Gemini or an OpenAI-compatible provider when fallback keys are configured.

### "Failed to fetch N feeds"

Some RSS feeds may be unavailable. The script skips failed feeds and continues.

### "No articles found in time range"

Increase the time range, for example from 24 hours to 48 hours.
