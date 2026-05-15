import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./digest.ts", import.meta.url), "utf8");

const expectedCategories = [
  { id: "ai-ml", label: "AI / ML" },
  { id: "ai-infra", label: "AI Infra" },
  { id: "inference-performance", label: "Inference Performance" },
  { id: "cuda-kernels", label: "CUDA Kernels" },
  { id: "pytorch-ecosystem", label: "PyTorch Ecosystem" },
  { id: "vllm-updates", label: "vLLM Updates" },
  { id: "security", label: "Security" },
  { id: "tools", label: "Tools / Open Source" },
  { id: "opinion", label: "Opinion" },
  { id: "other", label: "Other" },
];

const expectedCoverageTerms = [
  "GPU clusters",
  "model serving",
  "KV cache",
  "batching",
  "speculative decoding",
  "Triton",
  "GPU kernels",
  "torch.compile",
  "ATen",
  "vLLM releases",
  "PagedAttention",
];

const expectedSpecializedFeeds = [
  "vllm.ai",
  "pytorch.org",
  "developer.nvidia.com/blog",
  "cudaforfun.substack.com",
  "tridao.me",
  "siboehm.com",
  "blog.runpod.io",
  "anyscale.com",
  "huggingface.co",
  "together.ai",
  "newsletter.semianalysis.com",
];

describe("digest category coverage", () => {
  test("defines the specialized AI infrastructure and runtime categories", () => {
    for (const category of expectedCategories) {
      expect(source).toContain(`'${category.id}'`);
      expect(source).toContain(`label: '${category.label}'`);
    }
  });

  test("does not expose Engineering as a selectable or output category", () => {
    expect(source).not.toContain("label: 'Engineering'");
    expect(source).not.toContain("| 'engineering'");
    expect(source).not.toContain("- engineering:");
    expect(source).not.toContain('"category": "engineering"');
  });

  test("teaches the classifier how to distinguish specialized runtime coverage", () => {
    for (const term of expectedCoverageTerms) {
      expect(source).toContain(term);
    }
  });

  test("includes feeds that cover AI infra, inference, CUDA, PyTorch, and vLLM", () => {
    for (const feed of expectedSpecializedFeeds) {
      expect(source).toContain(`name: "${feed}"`);
    }
  });

  test("prints raw original links in digest article entries", () => {
    const originalLinkMentions = source.match(/Original link:/g) ?? [];
    expect(originalLinkMentions).toHaveLength(2);
  });

  test("reports failed feeds in the generated digest", () => {
    expect(source).toContain("interface FeedFailure");
    expect(source).toContain("failedFeeds: FeedFailure[]");
    expect(source).toContain("## Failed Feeds");
    expect(source).toContain("0 parsed items");
  });

  test("defaults to Claude Sonnet 4.6 with Anthropic batch processing support", () => {
    expect(source).toContain("claude-sonnet-4-6");
    expect(source).toContain("ANTHROPIC_BATCH");
    expect(source).toContain("/v1/messages/batches");
    expect(source).toContain("callBatch");
  });

  test("prioritizes technical AI infrastructure over low-value policy opinion and security", () => {
    expect(source).toContain("AI_INFRA_CATEGORY_BOOST");
    expect(source).toContain("DEPRIORITIZED_CATEGORY_PENALTY");
    expect(source).toContain("policy/regulation/legal");
    expect(source).toContain("security only when it directly affects AI infrastructure");
    expect(source).toContain("selectionScore");
  });

  test("applies a quality gate before the top-N cap", () => {
    expect(source).toContain("MIN_OUTPUT_SELECTION_SCORE");
    expect(source).toContain("MIN_OUTPUT_RELEVANCE_SCORE");
    expect(source).toContain("MIN_OUTPUT_QUALITY_SCORE");
    expect(source).toContain("selectQualityArticles");
    expect(source).toContain(".filter(candidate => isQualitySelectionCandidate(candidate))");
    expect(source).toContain(".slice(0, topN)");
  });
});
