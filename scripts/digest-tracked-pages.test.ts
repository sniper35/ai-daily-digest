import { describe, expect, test } from "bun:test";

import {
  buildTrackedPageArticles,
  extractTrackedPageCandidates,
  parseTrackedPageDate,
  type TrackedPageSource,
  type TrackedPageState,
} from "./digest";

describe("tracked page sources", () => {
  test("extracts article links that match source include patterns", () => {
    const source: TrackedPageSource = {
      name: "research.perplexity.ai",
      indexUrl: "https://research.perplexity.ai/",
      htmlUrl: "https://research.perplexity.ai",
      includeUrlPatterns: ["^https://research\\.perplexity\\.ai/articles/"],
    };

    const candidates = extractTrackedPageCandidates(`
      <a href="/articles/hosting-qwen-on-blackwell">research May 12, 2026 Hosting Qwen on Blackwell</a>
      <a href="https://jobs.ashbyhq.com/Perplexity/123">AI Researcher</a>
      <a href="/articles/cutedsl-at-perplexity">May 6, 2026 CuTeDSL at Perplexity</a>
    `, source);

    expect(candidates.map(candidate => candidate.url)).toEqual([
      "https://research.perplexity.ai/articles/hosting-qwen-on-blackwell",
      "https://research.perplexity.ai/articles/cutedsl-at-perplexity",
    ]);
  });

  test("does not extract arbitrary links for content-only page trackers", () => {
    const source: TrackedPageSource = {
      name: "notes.ekzhang.com/events/nysrg",
      indexUrl: "https://notes.ekzhang.com/events/nysrg",
      htmlUrl: "https://notes.ekzhang.com/events/nysrg",
      trackPageContent: true,
    };

    const candidates = extractTrackedPageCandidates(`
      <a href="https://github.com/example/project">External resource</a>
      <a href="/events/other">Internal navigation</a>
    `, source);

    expect(candidates).toEqual([]);
  });

  test("extracts matching article URLs from sitemap XML", () => {
    const source: TrackedPageSource = {
      name: "lmsys.org/blog",
      indexUrl: "https://www.lmsys.org/sitemap.xml",
      htmlUrl: "https://www.lmsys.org/blog",
      includeUrlPatterns: ["^https://lmsys\\.org/blog/\\d{4}-"],
    };

    const candidates = extractTrackedPageCandidates(`
      <urlset>
        <url><loc>https://lmsys.org/blog/2026-01-16-sglang-diffusion/</loc><lastmod>2026-01-17T00:00:00.000Z</lastmod></url>
        <url><loc>https://lmsys.org/about/</loc><lastmod>2026-01-17T00:00:00.000Z</lastmod></url>
      </urlset>
    `, source);

    expect(candidates).toEqual([
      {
        title: "2026 01 16 sglang diffusion",
        url: "https://lmsys.org/blog/2026-01-16-sglang-diffusion",
        text: "2026-01-17T00:00:00.000Z 2026 01 16 sglang diffusion",
        description: "Sitemap entry last modified 2026-01-17T00:00:00.000Z",
      },
    ]);
  });

  test("infers publication dates from link text and dated URLs", () => {
    expect(parseTrackedPageDate("research May 12, 2026 Hosting Qwen on Blackwell")?.toISOString().slice(0, 10)).toBe("2026-05-12");
    expect(parseTrackedPageDate("SGLang-Diffusion", "https://www.lmsys.org/blog/2026-01-16-sglang-diffusion/")?.toISOString().slice(0, 10)).toBe("2026-01-16");
  });

  test("baselines undated first-run links and emits later newly seen links", () => {
    const source: TrackedPageSource = {
      name: "davekilian.com",
      indexUrl: "https://davekilian.com/",
      htmlUrl: "https://davekilian.com",
      includeUrlPatterns: ["^https://davekilian\\.com/[^/]+\\.html$"],
    };
    const now = new Date("2026-05-16T12:00:00Z");

    const firstRun = buildTrackedPageArticles(source, [
      { title: "A Complete Guide to Lock Convoys", url: "https://davekilian.com/lock-convoys.html", text: "A Complete Guide to Lock Convoys" },
    ], {}, now);

    expect(firstRun.articles[0]?.pubDate.toISOString()).toBe("1970-01-01T00:00:00.000Z");

    const existingState: TrackedPageState = firstRun.state;
    const secondRun = buildTrackedPageArticles(source, [
      { title: "A Complete Guide to Lock Convoys", url: "https://davekilian.com/lock-convoys.html", text: "A Complete Guide to Lock Convoys" },
      { title: "New Systems Post", url: "https://davekilian.com/new-systems-post.html", text: "New Systems Post" },
    ], existingState, new Date("2026-05-17T12:00:00Z"));

    expect(secondRun.articles.find(article => article.link.endsWith("new-systems-post.html"))?.pubDate.toISOString()).toBe("2026-05-17T12:00:00.000Z");
  });
});
