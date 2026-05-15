# AI Daily Digest

Fetch recent posts from a curated list of Hacker News-popular technology blogs plus selected AI infrastructure and runtime sources, score them with an AI model, and generate a structured daily Markdown digest.

![AI Daily Digest overview](assets/overview.svg)

The source list is based on the [Hacker News Popularity Contest 2025](https://refactoringenglish.com/tools/hn-popularity/) and includes sites such as Simon Willison, Paul Graham, Overreacted, Gwern, Krebs on Security, and Daring Fireball.

## Usage

Ask your coding agent to run the `ai-daily-digest` skill. The agent will guide you through the configuration:

| Setting | Options | Default |
|---|---|---|
| Time range | 24h / 48h / 72h / 7d | 48h |
| Selected articles | Up to 10 / 15 / 25 after quality filtering | 25 |
| Output language | English | English |
| Anthropic API key | Manual input, saved for later | Required |

Configuration is saved to `~/.hn-daily-digest/config.json` for reuse.

### Direct CLI

```bash
export ANTHROPIC_API_KEY="your-key"
export ANTHROPIC_MODEL="claude-sonnet-4-6"
export ANTHROPIC_EFFORT="xhigh"
export ANTHROPIC_BATCH="true"
export GEMINI_API_KEY="your-gemini-key"
export OPENAI_API_KEY="your-openai-compatible-key"
export OPENAI_API_BASE="https://api.deepseek.com/v1"
export OPENAI_MODEL="deepseek-chat"

npx -y bun scripts/digest.ts --hours 48 --top-n 25 --lang en --output ./digest.md
```

### Codex App Automation

This repo includes a Codex App automation runner:

```bash
/Users/dongw/.bun/bin/bun scripts/run-digest-automation.ts
```

The runner reads `~/.hn-daily-digest/config.json`, sets the Anthropic environment without printing the API key, writes a timestamped report under `output/`, and refreshes:

- `output/latest-ai-daily-digest.md`
- `output/latest-ai-daily-digest.json`

Before scheduling, verify local readiness:

```bash
/Users/dongw/.bun/bin/bun scripts/run-digest-automation.ts --check-config
```

Codex App setup:

1. Open the Codex app Automations pane.
2. Create a standalone project automation for `/Users/dongw/Documents/OSS/ai-daily-digest`.
3. Use local project mode, not a worktree, so generated reports land in this checkout.
4. Use a daily custom cron such as `30 7 * * *`.
5. Paste the prompt from [automation/codex-app-automation-prompt.md](automation/codex-app-automation-prompt.md).

The project-local rule in `.codex/rules/ai-daily-digest-automation.rules` allowlists only the automation runner command. Restart Codex after adding or changing rules.

## Pipeline

```text
RSS fetch -> time filter -> AI scoring and classification -> AI summaries -> trend summary
```

1. RSS fetching: concurrently fetches all configured feeds with a 15 second timeout.
2. Time filtering: keeps posts inside the selected time window.
3. AI scoring: scores relevance, quality, and timeliness from 1 to 10, then assigns a category and keywords.
4. Technical selection: boosts AI infra, inference performance, CUDA/Triton kernels, PyTorch, and vLLM, then keeps only articles that clear relevance, quality, and AI-infra-domain thresholds. `--top-n` is a maximum, not a quota.
5. AI summaries: generates structured article summaries and recommendation reasons.
6. Trend summary: writes a concise overview of the main themes in the selected articles.

## Output

The generated Markdown digest includes:

| Section | Contents |
|---|---|
| Highlights | A short trend summary across the selected articles |
| Top reads | A deeper showcase of the top three articles, including each raw original link |
| Data overview | Feed/article counts, Mermaid charts, plain-text keyword chart, and tag cloud |
| Failed feeds | A table of unavailable, timed-out, blocked, or empty feeds skipped during the run |
| Category lists | Articles grouped by AI/ML, AI infra, inference performance, CUDA kernels, PyTorch ecosystem, vLLM updates, security, tools/open source, opinion, and other, with each raw original link shown |

## Categories

| Category | Coverage |
|---|---|
| AI / ML | General artificial intelligence, machine learning, LLMs, model research, datasets, and evaluation |
| AI Infra | GPU clusters, production model serving, deployment platforms, orchestration, observability, reliability, and data/model pipelines |
| Inference Performance | Latency, throughput, KV cache behavior, batching, quantization, speculative decoding, prefix caching, scheduling, and cost/performance benchmarks |
| CUDA Kernels | CUDA, Triton, GPU kernels, tensor cores, memory coalescing, FlashAttention-style kernels, kernel fusion, and GPU profiling |
| PyTorch Ecosystem | PyTorch core, torch.compile, TorchInductor, ATen, torchao, torchtune, torchvision, distributed PyTorch, and PyTorch ecosystem releases |
| vLLM Updates | vLLM releases, PagedAttention, model support, scheduler/runtime changes, plugins, benchmarks, and community updates |
| Security | Security, privacy, vulnerabilities, and cryptography |
| Tools / Open Source | Developer tools, open-source projects, libraries, and framework releases |
| Opinion | Industry analysis, personal essays, career topics, and culture |
| Other | Posts that do not fit the categories above |

## Requirements

- [Bun](https://bun.sh), available through `npx -y bun`
- At least one AI API key:
  - `ANTHROPIC_API_KEY` for the primary provider
  - optional `GEMINI_API_KEY` fallback
  - optional `OPENAI_API_KEY` fallback with `OPENAI_API_BASE` / `OPENAI_MODEL`
- Network access for RSS feeds and AI API calls

## AI Providers

The script selects providers in this order:

1. `ANTHROPIC_API_KEY`: primary provider, default `ANTHROPIC_MODEL=claude-sonnet-4-6`, `ANTHROPIC_EFFORT=xhigh`, and `ANTHROPIC_BATCH=true`
2. `GEMINI_API_KEY`: fallback provider
3. `OPENAI_API_KEY`: OpenAI-compatible fallback provider

Anthropic batch mode uses the Message Batches API for AI scoring, summaries, and highlights. It is asynchronous and can take longer than direct Messages API calls, but Anthropic prices batch requests at a 50% discount.

The default editorial profile is technical AI infrastructure. Policy/regulation/legal stories, broad opinion pieces, general software engineering, general security news, career/culture posts, and company drama are intentionally filtered out unless they directly affect AI infrastructure, model serving, GPU runtimes, PyTorch, vLLM, or production ML systems.

| Provider | API endpoint | Key variable |
|---|---|---|
| Anthropic | `https://api.anthropic.com/v1/messages` | `ANTHROPIC_API_KEY` |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent` | `GEMINI_API_KEY` |
| OpenAI | `https://api.openai.com/v1/chat/completions` | `OPENAI_API_KEY` |
| DeepSeek | `https://api.deepseek.com/v1/chat/completions` | `DEEPSEEK_API_KEY` |
| OpenAI-compatible API | Custom endpoint | Custom key |

## Feed Sources

The full feed list is embedded in [scripts/digest.ts](scripts/digest.ts). Runtime and infrastructure coverage includes vLLM, PyTorch, NVIDIA Developer Blog, CUDA For Fun, Tri Dao, Together AI, Runpod, Anyscale, Hugging Face, and SemiAnalysis sources.
