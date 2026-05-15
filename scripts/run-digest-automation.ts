import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

type DigestConfig = {
  anthropicApiKey?: string;
  anthropicModel?: string;
  anthropicEffort?: string;
  anthropicMaxTokens?: number;
  anthropicBatch?: boolean;
  timeRange?: number;
  topN?: number;
  language?: string;
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const configPath = resolve(process.env.HOME || '', '.hn-daily-digest/config.json');
const digestScript = resolve(repoRoot, 'scripts/digest.ts');
const outputDir = resolve(repoRoot, 'output');
const latestDigestPath = resolve(outputDir, 'latest-ai-daily-digest.md');
const latestMetaPath = resolve(outputDir, 'latest-ai-daily-digest.json');

function loadConfig(): DigestConfig {
  if (!existsSync(configPath)) {
    throw new Error(`Missing digest config: ${configPath}`);
  }

  return JSON.parse(readFileSync(configPath, 'utf8')) as DigestConfig;
}

function assertReady(config: DigestConfig): void {
  if (!existsSync(digestScript)) {
    throw new Error(`Missing digest script: ${digestScript}`);
  }
  if (!config.anthropicApiKey) {
    throw new Error(`Missing anthropicApiKey in ${configPath}`);
  }
  mkdirSync(outputDir, { recursive: true });
}

function stampForFilename(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z');
}

const config = loadConfig();
assertReady(config);

if (process.argv.includes('--check-config')) {
  console.log('[automation] Digest automation is ready.');
  console.log(`[automation] Config: ${configPath}`);
  console.log(`[automation] Model: ${config.anthropicModel || 'claude-sonnet-4-6'}`);
  console.log(`[automation] Effort: ${config.anthropicEffort || 'xhigh'}`);
  console.log(`[automation] Batch: ${config.anthropicBatch === false ? 'off' : 'on'}`);
  console.log(`[automation] Time range: ${config.timeRange || 48}h`);
  console.log(`[automation] Max articles: ${config.topN || 25}`);
  console.log(`[automation] Output dir: ${outputDir}`);
  process.exit(0);
}

const now = new Date();
const outputPath = resolve(outputDir, `ai-daily-digest-${stampForFilename(now)}.md`);

process.chdir(repoRoot);
process.env.ANTHROPIC_API_KEY = config.anthropicApiKey || '';
process.env.ANTHROPIC_MODEL = config.anthropicModel || 'claude-sonnet-4-6';
process.env.ANTHROPIC_EFFORT = config.anthropicEffort || 'xhigh';
process.env.ANTHROPIC_MAX_TOKENS = String(config.anthropicMaxTokens || 100_000);
process.env.ANTHROPIC_BATCH = String(config.anthropicBatch !== false);

process.argv = [
  process.argv[0] || 'bun',
  digestScript,
  '--hours',
  String(config.timeRange || 48),
  '--top-n',
  String(config.topN || 25),
  '--lang',
  'en',
  '--output',
  outputPath,
];

await import(pathToFileURL(digestScript).href);

copyFileSync(outputPath, latestDigestPath);
writeFileSync(
  latestMetaPath,
  `${JSON.stringify({
    generatedAt: now.toISOString(),
    outputPath,
    latestDigestPath,
    config: {
      anthropicModel: process.env.ANTHROPIC_MODEL,
      anthropicEffort: process.env.ANTHROPIC_EFFORT,
      anthropicMaxTokens: Number(process.env.ANTHROPIC_MAX_TOKENS),
      anthropicBatch: process.env.ANTHROPIC_BATCH === 'true',
      timeRange: config.timeRange || 48,
      topN: config.topN || 25,
      language: 'en',
    },
  }, null, 2)}\n`
);

console.log(`[automation] Latest digest: ${latestDigestPath}`);
console.log(`[automation] Metadata: ${latestMetaPath}`);
