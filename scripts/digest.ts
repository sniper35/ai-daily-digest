import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';

// ============================================================================
// Constants
// ============================================================================

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const ANTHROPIC_MESSAGES_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_BATCHES_API_URL = 'https://api.anthropic.com/v1/messages/batches';
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_DEFAULT_EFFORT: AnthropicEffort = 'xhigh';
const ANTHROPIC_DEFAULT_MAX_TOKENS = 100_000;
const ANTHROPIC_DEFAULT_BATCH = true;
const ANTHROPIC_BATCH_POLL_INTERVAL_MS = 10_000;
const ANTHROPIC_BATCH_POLL_TIMEOUT_MS = 30 * 60_000;
const OPENAI_DEFAULT_API_BASE = 'https://api.openai.com/v1';
const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_TOP_N = 25;
const FEED_FETCH_TIMEOUT_MS = 15_000;
const FEED_CONCURRENCY = 10;
const GEMINI_BATCH_SIZE = 10;
const MIN_OUTPUT_SELECTION_SCORE = 25;
const MIN_OUTPUT_RELEVANCE_SCORE = 7;
const MIN_OUTPUT_QUALITY_SCORE = 6;

// RSS feeds from the Hacker News Popularity Contest 2025 list plus selected additions.
const RSS_FEEDS: Array<{ name: string; xmlUrl: string; htmlUrl: string }> = [
  { name: "simonwillison.net", xmlUrl: "https://simonwillison.net/atom/everything/", htmlUrl: "https://simonwillison.net" },
  { name: "jeffgeerling.com", xmlUrl: "https://www.jeffgeerling.com/blog.xml", htmlUrl: "https://jeffgeerling.com" },
  { name: "seangoedecke.com", xmlUrl: "https://www.seangoedecke.com/rss.xml", htmlUrl: "https://seangoedecke.com" },
  { name: "krebsonsecurity.com", xmlUrl: "https://krebsonsecurity.com/feed/", htmlUrl: "https://krebsonsecurity.com" },
  { name: "daringfireball.net", xmlUrl: "https://daringfireball.net/feeds/main", htmlUrl: "https://daringfireball.net" },
  { name: "ericmigi.com", xmlUrl: "https://ericmigi.com/rss.xml", htmlUrl: "https://ericmigi.com" },
  { name: "antirez.com", xmlUrl: "http://antirez.com/rss", htmlUrl: "http://antirez.com" },
  { name: "idiallo.com", xmlUrl: "https://idiallo.com/feed.rss", htmlUrl: "https://idiallo.com" },
  { name: "maurycyz.com", xmlUrl: "https://maurycyz.com/index.xml", htmlUrl: "https://maurycyz.com" },
  { name: "pluralistic.net", xmlUrl: "https://pluralistic.net/feed/", htmlUrl: "https://pluralistic.net" },
  { name: "shkspr.mobi", xmlUrl: "https://shkspr.mobi/blog/feed/", htmlUrl: "https://shkspr.mobi" },
  { name: "lcamtuf.substack.com", xmlUrl: "https://lcamtuf.substack.com/feed", htmlUrl: "https://lcamtuf.substack.com" },
  { name: "mitchellh.com", xmlUrl: "https://mitchellh.com/feed.xml", htmlUrl: "https://mitchellh.com" },
  { name: "dynomight.net", xmlUrl: "https://dynomight.net/feed.xml", htmlUrl: "https://dynomight.net" },
  { name: "utcc.utoronto.ca/~cks", xmlUrl: "https://utcc.utoronto.ca/~cks/space/blog/?atom", htmlUrl: "https://utcc.utoronto.ca/~cks" },
  { name: "xeiaso.net", xmlUrl: "https://xeiaso.net/blog.rss", htmlUrl: "https://xeiaso.net" },
  { name: "devblogs.microsoft.com/oldnewthing", xmlUrl: "https://devblogs.microsoft.com/oldnewthing/feed", htmlUrl: "https://devblogs.microsoft.com/oldnewthing" },
  { name: "righto.com", xmlUrl: "https://www.righto.com/feeds/posts/default", htmlUrl: "https://righto.com" },
  { name: "lucumr.pocoo.org", xmlUrl: "https://lucumr.pocoo.org/feed.atom", htmlUrl: "https://lucumr.pocoo.org" },
  { name: "skyfall.dev", xmlUrl: "https://skyfall.dev/rss.xml", htmlUrl: "https://skyfall.dev" },
  { name: "garymarcus.substack.com", xmlUrl: "https://garymarcus.substack.com/feed", htmlUrl: "https://garymarcus.substack.com" },
  { name: "rachelbythebay.com", xmlUrl: "https://rachelbythebay.com/w/atom.xml", htmlUrl: "https://rachelbythebay.com" },
  { name: "overreacted.io", xmlUrl: "https://overreacted.io/rss.xml", htmlUrl: "https://overreacted.io" },
  { name: "timsh.org", xmlUrl: "https://timsh.org/rss/", htmlUrl: "https://timsh.org" },
  { name: "johndcook.com", xmlUrl: "https://www.johndcook.com/blog/feed/", htmlUrl: "https://johndcook.com" },
  { name: "gilesthomas.com", xmlUrl: "https://gilesthomas.com/feed/rss.xml", htmlUrl: "https://gilesthomas.com" },
  { name: "matklad.github.io", xmlUrl: "https://matklad.github.io/feed.xml", htmlUrl: "https://matklad.github.io" },
  { name: "derekthompson.org", xmlUrl: "https://www.theatlantic.com/feed/author/derek-thompson/", htmlUrl: "https://derekthompson.org" },
  { name: "evanhahn.com", xmlUrl: "https://evanhahn.com/feed.xml", htmlUrl: "https://evanhahn.com" },
  { name: "terriblesoftware.org", xmlUrl: "https://terriblesoftware.org/feed/", htmlUrl: "https://terriblesoftware.org" },
  { name: "rakhim.exotext.com", xmlUrl: "https://rakhim.exotext.com/rss.xml", htmlUrl: "https://rakhim.exotext.com" },
  { name: "joanwestenberg.com", xmlUrl: "https://joanwestenberg.com/rss", htmlUrl: "https://joanwestenberg.com" },
  { name: "xania.org", xmlUrl: "https://xania.org/feed", htmlUrl: "https://xania.org" },
  { name: "micahflee.com", xmlUrl: "https://micahflee.com/feed/", htmlUrl: "https://micahflee.com" },
  { name: "nesbitt.io", xmlUrl: "https://nesbitt.io/feed.xml", htmlUrl: "https://nesbitt.io" },
  { name: "construction-physics.com", xmlUrl: "https://www.construction-physics.com/feed", htmlUrl: "https://construction-physics.com" },
  { name: "tedium.co", xmlUrl: "https://feed.tedium.co/", htmlUrl: "https://tedium.co" },
  { name: "susam.net", xmlUrl: "https://susam.net/feed.xml", htmlUrl: "https://susam.net" },
  { name: "entropicthoughts.com", xmlUrl: "https://entropicthoughts.com/feed.xml", htmlUrl: "https://entropicthoughts.com" },
  { name: "buttondown.com/hillelwayne", xmlUrl: "https://buttondown.com/hillelwayne/rss", htmlUrl: "https://buttondown.com/hillelwayne" },
  { name: "dwarkesh.com", xmlUrl: "https://www.dwarkeshpatel.com/feed", htmlUrl: "https://dwarkesh.com" },
  { name: "borretti.me", xmlUrl: "https://borretti.me/feed.xml", htmlUrl: "https://borretti.me" },
  { name: "wheresyoured.at", xmlUrl: "https://www.wheresyoured.at/rss/", htmlUrl: "https://wheresyoured.at" },
  { name: "jayd.ml", xmlUrl: "https://jayd.ml/feed.xml", htmlUrl: "https://jayd.ml" },
  { name: "minimaxir.com", xmlUrl: "https://minimaxir.com/index.xml", htmlUrl: "https://minimaxir.com" },
  { name: "geohot.github.io", xmlUrl: "https://geohot.github.io/blog/feed.xml", htmlUrl: "https://geohot.github.io" },
  { name: "paulgraham.com", xmlUrl: "http://www.aaronsw.com/2002/feeds/pgessays.rss", htmlUrl: "https://paulgraham.com" },
  { name: "filfre.net", xmlUrl: "https://www.filfre.net/feed/", htmlUrl: "https://filfre.net" },
  { name: "blog.jim-nielsen.com", xmlUrl: "https://blog.jim-nielsen.com/feed.xml", htmlUrl: "https://blog.jim-nielsen.com" },
  { name: "dfarq.homeip.net", xmlUrl: "https://dfarq.homeip.net/feed/", htmlUrl: "https://dfarq.homeip.net" },
  { name: "jyn.dev", xmlUrl: "https://jyn.dev/atom.xml", htmlUrl: "https://jyn.dev" },
  { name: "geoffreylitt.com", xmlUrl: "https://www.geoffreylitt.com/feed.xml", htmlUrl: "https://geoffreylitt.com" },
  { name: "downtowndougbrown.com", xmlUrl: "https://www.downtowndougbrown.com/feed/", htmlUrl: "https://downtowndougbrown.com" },
  { name: "brutecat.com", xmlUrl: "https://brutecat.com/rss.xml", htmlUrl: "https://brutecat.com" },
  { name: "eli.thegreenplace.net", xmlUrl: "https://eli.thegreenplace.net/feeds/all.atom.xml", htmlUrl: "https://eli.thegreenplace.net" },
  { name: "abortretry.fail", xmlUrl: "https://www.abortretry.fail/feed", htmlUrl: "https://abortretry.fail" },
  { name: "fabiensanglard.net", xmlUrl: "https://fabiensanglard.net/rss.xml", htmlUrl: "https://fabiensanglard.net" },
  { name: "oldvcr.blogspot.com", xmlUrl: "https://oldvcr.blogspot.com/feeds/posts/default", htmlUrl: "https://oldvcr.blogspot.com" },
  { name: "bogdanthegeek.github.io", xmlUrl: "https://bogdanthegeek.github.io/blog/index.xml", htmlUrl: "https://bogdanthegeek.github.io" },
  { name: "hugotunius.se", xmlUrl: "https://hugotunius.se/feed.xml", htmlUrl: "https://hugotunius.se" },
  { name: "gwern.net", xmlUrl: "https://gwern.substack.com/feed", htmlUrl: "https://gwern.net" },
  { name: "berthub.eu", xmlUrl: "https://berthub.eu/articles/index.xml", htmlUrl: "https://berthub.eu" },
  { name: "chadnauseam.com", xmlUrl: "https://chadnauseam.com/rss.xml", htmlUrl: "https://chadnauseam.com" },
  { name: "simone.org", xmlUrl: "https://simone.org/feed/", htmlUrl: "https://simone.org" },
  { name: "it-notes.dragas.net", xmlUrl: "https://it-notes.dragas.net/feed/", htmlUrl: "https://it-notes.dragas.net" },
  { name: "beej.us", xmlUrl: "https://beej.us/blog/rss.xml", htmlUrl: "https://beej.us" },
  { name: "hey.paris", xmlUrl: "https://hey.paris/index.xml", htmlUrl: "https://hey.paris" },
  { name: "danielwirtz.com", xmlUrl: "https://danielwirtz.com/rss.xml", htmlUrl: "https://danielwirtz.com" },
  { name: "matduggan.com", xmlUrl: "https://matduggan.com/rss/", htmlUrl: "https://matduggan.com" },
  { name: "refactoringenglish.com", xmlUrl: "https://refactoringenglish.com/index.xml", htmlUrl: "https://refactoringenglish.com" },
  { name: "worksonmymachine.substack.com", xmlUrl: "https://worksonmymachine.substack.com/feed", htmlUrl: "https://worksonmymachine.substack.com" },
  { name: "philiplaine.com", xmlUrl: "https://philiplaine.com/index.xml", htmlUrl: "https://philiplaine.com" },
  { name: "steveblank.com", xmlUrl: "https://steveblank.com/feed/", htmlUrl: "https://steveblank.com" },
  { name: "bernsteinbear.com", xmlUrl: "https://bernsteinbear.com/feed.xml", htmlUrl: "https://bernsteinbear.com" },
  { name: "danieldelaney.net", xmlUrl: "https://danieldelaney.net/feed", htmlUrl: "https://danieldelaney.net" },
  { name: "troyhunt.com", xmlUrl: "https://www.troyhunt.com/rss/", htmlUrl: "https://troyhunt.com" },
  { name: "herman.bearblog.dev", xmlUrl: "https://herman.bearblog.dev/feed/", htmlUrl: "https://herman.bearblog.dev" },
  { name: "tomrenner.com", xmlUrl: "https://tomrenner.com/index.xml", htmlUrl: "https://tomrenner.com" },
  { name: "blog.pixelmelt.dev", xmlUrl: "https://blog.pixelmelt.dev/rss/", htmlUrl: "https://blog.pixelmelt.dev" },
  { name: "martinalderson.com", xmlUrl: "https://martinalderson.com/feed.xml", htmlUrl: "https://martinalderson.com" },
  { name: "danielchasehooper.com", xmlUrl: "https://danielchasehooper.com/feed.xml", htmlUrl: "https://danielchasehooper.com" },
  { name: "chiark.greenend.org.uk/~sgtatham", xmlUrl: "https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/feed.xml", htmlUrl: "https://chiark.greenend.org.uk/~sgtatham" },
  { name: "grantslatton.com", xmlUrl: "https://grantslatton.com/rss.xml", htmlUrl: "https://grantslatton.com" },
  { name: "experimental-history.com", xmlUrl: "https://www.experimental-history.com/feed", htmlUrl: "https://experimental-history.com" },
  { name: "anildash.com", xmlUrl: "https://anildash.com/feed.xml", htmlUrl: "https://anildash.com" },
  { name: "aresluna.org", xmlUrl: "https://aresluna.org/main.rss", htmlUrl: "https://aresluna.org" },
  { name: "michael.stapelberg.ch", xmlUrl: "https://michael.stapelberg.ch/feed.xml", htmlUrl: "https://michael.stapelberg.ch" },
  { name: "miguelgrinberg.com", xmlUrl: "https://blog.miguelgrinberg.com/feed", htmlUrl: "https://miguelgrinberg.com" },
  { name: "keygen.sh", xmlUrl: "https://keygen.sh/blog/feed.xml", htmlUrl: "https://keygen.sh" },
  { name: "mjg59.dreamwidth.org", xmlUrl: "https://mjg59.dreamwidth.org/data/rss", htmlUrl: "https://mjg59.dreamwidth.org" },
  { name: "computer.rip", xmlUrl: "https://computer.rip/rss.xml", htmlUrl: "https://computer.rip" },
  { name: "tedunangst.com", xmlUrl: "https://www.tedunangst.com/flak/rss", htmlUrl: "https://tedunangst.com" },
  { name: "blog.evjang.com", xmlUrl: "https://blog.evjang.com/feeds/posts/default", htmlUrl: "https://blog.evjang.com" },
  { name: "sankalp.bearblog.dev", xmlUrl: "https://sankalp.bearblog.dev/feed/", htmlUrl: "https://sankalp.bearblog.dev" },
  { name: "openai.com", xmlUrl: "https://openai.com/news/rss.xml", htmlUrl: "https://openai.com" },
  { name: "blog.ezyang.com", xmlUrl: "https://blog.ezyang.com/feed.xml", htmlUrl: "https://blog.ezyang.com" },
  { name: "patricktoulme.substack.com", xmlUrl: "https://patricktoulme.substack.com/feed", htmlUrl: "https://patricktoulme.substack.com" },
  { name: "blog.miigon.net", xmlUrl: "https://blog.miigon.net/feed.xml", htmlUrl: "https://blog.miigon.net" },
  { name: "brooker.co.za", xmlUrl: "https://brooker.co.za/blog/rss.xml", htmlUrl: "https://brooker.co.za" },
  { name: "cudaforfun.substack.com", xmlUrl: "https://cudaforfun.substack.com/feed", htmlUrl: "https://cudaforfun.substack.com" },
  { name: "veitner.bearblog.dev", xmlUrl: "https://veitner.bearblog.dev/feed/", htmlUrl: "https://veitner.bearblog.dev" },
  { name: "blog.eleuther.ai", xmlUrl: "https://blog.eleuther.ai/index.xml", htmlUrl: "https://blog.eleuther.ai" },
  { name: "vllm.ai", xmlUrl: "https://vllm.ai/blog/rss.xml", htmlUrl: "https://vllm.ai/blog" },
  { name: "dustintran.com", xmlUrl: "https://dustintran.com/blog/feed.xml", htmlUrl: "https://dustintran.com" },
  { name: "aleksagordic.com", xmlUrl: "https://www.aleksagordic.com/feed.xml", htmlUrl: "https://www.aleksagordic.com" },
  { name: "blog.edward-li.com", xmlUrl: "https://blog.edward-li.com/index.xml", htmlUrl: "https://blog.edward-li.com" },
  { name: "blog.runpod.io", xmlUrl: "https://www.runpod.io/blog/rss.xml", htmlUrl: "https://blog.runpod.io" },
  { name: "blog.sinatras.dev", xmlUrl: "https://blog.sinatras.dev/rss.xml", htmlUrl: "https://blog.sinatras.dev" },
  { name: "cruciblecapital.substack.com", xmlUrl: "https://cruciblecapital.substack.com/feed", htmlUrl: "https://cruciblecapital.substack.com" },
  { name: "developer.nvidia.com/blog", xmlUrl: "https://developer.nvidia.com/blog/feed", htmlUrl: "https://developer.nvidia.com/blog" },
  { name: "fkong.tech", xmlUrl: "https://fkong.tech/index.xml", htmlUrl: "https://fkong.tech" },
  { name: "pytorch.org", xmlUrl: "https://pytorch.org/feed/", htmlUrl: "https://pytorch.org" },
  { name: "anyscale.com", xmlUrl: "https://www.anyscale.com/rss.xml", htmlUrl: "https://www.anyscale.com" },
  { name: "together.ai", xmlUrl: "https://www.together.ai/blog/rss.xml", htmlUrl: "https://www.together.ai/blog" },
  { name: "cursor.com", xmlUrl: "https://cursor.com/atom.xml", htmlUrl: "https://www.cursor.com" },
  { name: "danielvegamyhre.github.io", xmlUrl: "https://danielvegamyhre.github.io/feed.xml", htmlUrl: "https://danielvegamyhre.github.io" },
  { name: "goyalpramod.github.io", xmlUrl: "https://goyalpramod.github.io/feed.xml", htmlUrl: "https://goyalpramod.github.io" },
  { name: "huggingface.co", xmlUrl: "https://huggingface.co/blog/feed.xml", htmlUrl: "https://huggingface.co" },
  { name: "latent.space", xmlUrl: "https://www.latent.space/feed", htmlUrl: "https://www.latent.space" },
  { name: "yang-song.net", xmlUrl: "https://yang-song.net/feed.xml", htmlUrl: "https://yang-song.net" },
  { name: "colah.github.io", xmlUrl: "https://colah.github.io/rss.xml", htmlUrl: "https://colah.github.io" },
  { name: "gau-nernst.github.io", xmlUrl: "https://gau-nernst.github.io/index.xml", htmlUrl: "https://gau-nernst.github.io" },
  { name: "thinkingmachines.ai", xmlUrl: "https://thinkingmachines.ai/index.xml", htmlUrl: "https://thinkingmachines.ai" },
  { name: "tridao.me", xmlUrl: "https://tridao.me/feed.xml", htmlUrl: "https://tridao.me" },
  { name: "medium.com/@joaolages", xmlUrl: "https://medium.com/feed/@joaolages", htmlUrl: "https://medium.com/@joaolages" },
  { name: "newsletter.semianalysis.com", xmlUrl: "https://newsletter.semianalysis.com/feed", htmlUrl: "https://newsletter.semianalysis.com" },
  { name: "tensoreconomics.com", xmlUrl: "https://www.tensoreconomics.com/feed", htmlUrl: "https://www.tensoreconomics.com" },
  { name: "abhik.ai", xmlUrl: "https://www.abhik.ai/rss/feed.xml", htmlUrl: "https://www.abhik.ai" },
  { name: "gordicaleksa.medium.com", xmlUrl: "https://gordicaleksa.medium.com/feed", htmlUrl: "https://gordicaleksa.medium.com" },
  { name: "kapilsharma.dev", xmlUrl: "https://www.kapilsharma.dev/feed.xml", htmlUrl: "https://www.kapilsharma.dev" },
  { name: "lei.chat", xmlUrl: "https://www.lei.chat/index.xml", htmlUrl: "https://www.lei.chat" },
  { name: "siboehm.com", xmlUrl: "https://siboehm.com/feed.xml", htmlUrl: "https://siboehm.com" },
  { name: "lilianweng.github.io", xmlUrl: "https://lilianweng.github.io/index.xml", htmlUrl: "https://lilianweng.github.io" },
  { name: "szymonozog.github.io", xmlUrl: "https://szymonozog.github.io/feed.xml", htmlUrl: "https://szymonozog.github.io" },
];

// ============================================================================
// Types
// ============================================================================

type CategoryId =
  | 'ai-ml'
  | 'ai-infra'
  | 'inference-performance'
  | 'cuda-kernels'
  | 'pytorch-ecosystem'
  | 'vllm-updates'
  | 'security'
  | 'tools'
  | 'opinion'
  | 'other';
type AnthropicEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
type AnthropicApiEffort = Exclude<AnthropicEffort, 'xhigh'>;
type OutputLanguage = 'en';

const CATEGORY_META: Record<CategoryId, { emoji: string; label: string }> = {
  'ai-ml':                 { emoji: '🤖', label: 'AI / ML' },
  'ai-infra':              { emoji: '🏗️', label: 'AI Infra' },
  'inference-performance': { emoji: '🚀', label: 'Inference Performance' },
  'cuda-kernels':          { emoji: '🧮', label: 'CUDA Kernels' },
  'pytorch-ecosystem':     { emoji: '🔥', label: 'PyTorch Ecosystem' },
  'vllm-updates':          { emoji: '⚡', label: 'vLLM Updates' },
  'security':              { emoji: '🔒', label: 'Security' },
  'tools':                 { emoji: '🛠', label: 'Tools / Open Source' },
  'opinion':               { emoji: '💡', label: 'Opinion' },
  'other':                 { emoji: '📝', label: 'Other' },
};

const DEPRIORITIZED_CATEGORY_PENALTY = 10;
const AI_INFRA_CATEGORY_BOOST: Record<CategoryId, number> = {
  'ai-infra': 12,
  'inference-performance': 12,
  'cuda-kernels': 12,
  'pytorch-ecosystem': 10,
  'vllm-updates': 10,
  'ai-ml': 3,
  'tools': 0,
  'security': -DEPRIORITIZED_CATEGORY_PENALTY,
  'opinion': -12,
  'other': -8,
};

const TARGET_OUTPUT_CATEGORIES = new Set<CategoryId>([
  'ai-infra',
  'inference-performance',
  'cuda-kernels',
  'pytorch-ecosystem',
  'vllm-updates',
]);

const TECHNICAL_AI_INFRA_SOURCES = new Set([
  'vllm.ai',
  'pytorch.org',
  'developer.nvidia.com/blog',
  'cudaforfun.substack.com',
  'tridao.me',
  'siboehm.com',
  'blog.runpod.io',
  'anyscale.com',
  'huggingface.co',
  'together.ai',
  'newsletter.semianalysis.com',
  'blog.ezyang.com',
]);

const TECHNICAL_AI_INFRA_TERMS = [
  'ai infra', 'infrastructure', 'serving', 'model serving', 'inference', 'latency', 'throughput',
  'batching', 'kv cache', 'prefix caching', 'speculative decoding', 'quantization', 'scheduler',
  'cuda', 'triton', 'kernel', 'gpu', 'tensor core', 'flashattention', 'pytorch', 'torch.compile',
  'torchinductor', 'aten', 'vllm', 'pagedattention', 'ray', 'runpod', 'h100', 'b200',
];

const LOW_VALUE_TOPIC_TERMS = [
  'policy/regulation/legal', 'policy', 'regulation', 'regulatory', 'legal', 'lawsuit',
  'politics', 'government', 'culture', 'career', 'opinion', 'essay', 'security breach',
  'vulnerability', 'malware', 'privacy',
];

interface Article {
  title: string;
  link: string;
  pubDate: Date;
  description: string;
  sourceName: string;
  sourceUrl: string;
}

interface FeedFailure {
  name: string;
  xmlUrl: string;
  htmlUrl: string;
  reason: string;
}

interface FeedFetchResult {
  articles: Article[];
  failure?: FeedFailure;
}

interface FeedFetchSummary {
  articles: Article[];
  failedFeeds: FeedFailure[];
  successCount: number;
  failCount: number;
}

interface ScoredArticle extends Article {
  score: number;
  selectionScore: number;
  scoreBreakdown: {
    relevance: number;
    quality: number;
    timeliness: number;
  };
  category: CategoryId;
  keywords: string[];
  displayTitle: string;
  summary: string;
  reason: string;
}

interface RankedArticle extends Article {
  totalScore: number;
  selectionScore: number;
  breakdown: {
    relevance: number;
    quality: number;
    timeliness: number;
    category: CategoryId;
    keywords: string[];
  };
}

interface GeminiScoringResult {
  results: Array<{
    index: number;
    relevance: number;
    quality: number;
    timeliness: number;
    category: string;
    keywords: string[];
  }>;
}

interface GeminiSummaryResult {
  results: Array<{
    index: number;
    displayTitle: string;
    summary: string;
    reason: string;
  }>;
}

interface AIClient {
  call(prompt: string): Promise<string>;
  callBatch(prompts: string[]): Promise<string[]>;
}

// ============================================================================
// RSS/Atom Parsing (using Bun's built-in HTMLRewriter or manual XML parsing)
// ============================================================================

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .trim();
}

function extractCDATA(text: string): string {
  const cdataMatch = text.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return cdataMatch ? cdataMatch[1] : text;
}

function getTagContent(xml: string, tagName: string): string {
  // Handle namespaced and non-namespaced tags
  const patterns = [
    new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'),
    new RegExp(`<${tagName}[^>]*/>`, 'i'), // self-closing
  ];
  
  for (const pattern of patterns) {
    const match = xml.match(pattern);
    if (match?.[1]) {
      return extractCDATA(match[1]).trim();
    }
  }
  return '';
}

function getAttrValue(xml: string, tagName: string, attrName: string): string {
  const pattern = new RegExp(`<${tagName}[^>]*\\s${attrName}=["']([^"']*)["'][^>]*/?>`, 'i');
  const match = xml.match(pattern);
  return match?.[1] || '';
}

function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;
  
  // Try common RSS date formats
  // RFC 822: "Mon, 01 Jan 2024 00:00:00 GMT"
  const rfc822 = dateStr.match(/(\d{1,2})\s+(\w{3})\s+(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (rfc822) {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  return null;
}

function parseRSSItems(xml: string): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];
  
  // Detect format: Atom vs RSS
  const isAtom = xml.includes('<feed') && xml.includes('xmlns="http://www.w3.org/2005/Atom"') || xml.includes('<feed ');
  
  if (isAtom) {
    // Atom format: <entry>
    const entryPattern = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    let entryMatch;
    while ((entryMatch = entryPattern.exec(xml)) !== null) {
      const entryXml = entryMatch[1];
      const title = stripHtml(getTagContent(entryXml, 'title'));
      
      // Atom link: <link href="..." rel="alternate"/>
      let link = getAttrValue(entryXml, 'link[^>]*rel="alternate"', 'href');
      if (!link) {
        link = getAttrValue(entryXml, 'link', 'href');
      }
      
      const pubDate = getTagContent(entryXml, 'published') 
        || getTagContent(entryXml, 'updated');
      
      const description = stripHtml(
        getTagContent(entryXml, 'summary') 
        || getTagContent(entryXml, 'content')
      );
      
      if (title || link) {
        items.push({ title, link, pubDate, description: description.slice(0, 500) });
      }
    }
  } else {
    // RSS format: <item>
    const itemPattern = /<item[\s>]([\s\S]*?)<\/item>/gi;
    let itemMatch;
    while ((itemMatch = itemPattern.exec(xml)) !== null) {
      const itemXml = itemMatch[1];
      const title = stripHtml(getTagContent(itemXml, 'title'));
      const link = getTagContent(itemXml, 'link') || getTagContent(itemXml, 'guid');
      const pubDate = getTagContent(itemXml, 'pubDate') 
        || getTagContent(itemXml, 'dc:date')
        || getTagContent(itemXml, 'date');
      const description = stripHtml(
        getTagContent(itemXml, 'description') 
        || getTagContent(itemXml, 'content:encoded')
      );
      
      if (title || link) {
        items.push({ title, link, pubDate, description: description.slice(0, 500) });
      }
    }
  }
  
  return items;
}

// ============================================================================
// Feed Fetching
// ============================================================================

async function fetchFeed(feed: { name: string; xmlUrl: string; htmlUrl: string }): Promise<FeedFetchResult> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), FEED_FETCH_TIMEOUT_MS);
    
    const response = await fetch(feed.xmlUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'AI-Daily-Digest/1.0 (RSS Reader)',
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    });
    
    clearTimeout(timeout);
    timeout = undefined;
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const xml = await response.text();
    const items = parseRSSItems(xml);

    if (items.length === 0) {
      const reason = '0 parsed items';
      console.warn(`[digest] ✗ ${feed.name}: ${reason}`);
      return {
        articles: [],
        failure: { name: feed.name, xmlUrl: feed.xmlUrl, htmlUrl: feed.htmlUrl, reason },
      };
    }
    
    return {
      articles: items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: parseDate(item.pubDate) || new Date(0),
        description: item.description,
        sourceName: feed.name,
        sourceUrl: feed.htmlUrl,
      })),
    };
  } catch (error) {
    if (timeout) clearTimeout(timeout);
    const msg = error instanceof Error ? error.message : String(error);
    const isTimeout = error instanceof Error && (error.name === 'AbortError' || msg.includes('abort'));
    const reason = isTimeout ? 'timeout' : msg;
    console.warn(`[digest] ✗ ${feed.name}: ${reason}`);
    return {
      articles: [],
      failure: { name: feed.name, xmlUrl: feed.xmlUrl, htmlUrl: feed.htmlUrl, reason },
    };
  }
}

async function fetchAllFeeds(feeds: typeof RSS_FEEDS): Promise<FeedFetchSummary> {
  const allArticles: Article[] = [];
  const failedFeeds: FeedFailure[] = [];
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < feeds.length; i += FEED_CONCURRENCY) {
    const batch = feeds.slice(i, i + FEED_CONCURRENCY);
    const results = await Promise.allSettled(batch.map(fetchFeed));
    
    for (const [index, result] of results.entries()) {
      const feed = batch[index]!;
      if (result.status === 'fulfilled' && result.value.articles.length > 0) {
        allArticles.push(...result.value.articles);
        successCount++;
      } else {
        failCount++;
        if (result.status === 'fulfilled') {
          failedFeeds.push(result.value.failure ?? {
            name: feed.name,
            xmlUrl: feed.xmlUrl,
            htmlUrl: feed.htmlUrl,
            reason: '0 parsed items',
          });
        } else {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          failedFeeds.push({ name: feed.name, xmlUrl: feed.xmlUrl, htmlUrl: feed.htmlUrl, reason });
        }
      }
    }
    
    const progress = Math.min(i + FEED_CONCURRENCY, feeds.length);
    console.log(`[digest] Progress: ${progress}/${feeds.length} feeds processed (${successCount} ok, ${failCount} failed)`);
  }
  
  console.log(`[digest] Fetched ${allArticles.length} articles from ${successCount} feeds (${failCount} failed)`);
  return { articles: allArticles, failedFeeds, successCount, failCount };
}

// ============================================================================
// AI Providers (Anthropic primary + Gemini/OpenAI-compatible fallbacks)
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function buildAnthropicMessageParams(prompt: string, model: string, effort: AnthropicEffort, maxTokens: number) {
  return {
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
    thinking: { type: 'adaptive' },
    output_config: { effort: toAnthropicApiEffort(effort) },
    temperature: 1,
  };
}

function extractAnthropicText(data: { content?: Array<{ type?: string; text?: string }> }): string {
  return data.content
    ?.filter(item => item.type === 'text' && typeof item.text === 'string')
    .map(item => item.text)
    .join('\n') || '';
}

async function callAnthropic(
  prompt: string,
  apiKey: string,
  model: string,
  effort: AnthropicEffort,
  maxTokens: number
): Promise<string> {
  const response = await fetch(ANTHROPIC_MESSAGES_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(buildAnthropicMessageParams(prompt, model, effort, maxTokens)),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Anthropic API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };

  return extractAnthropicText(data);
}

async function callAnthropicBatch(
  prompts: string[],
  apiKey: string,
  model: string,
  effort: AnthropicEffort,
  maxTokens: number
): Promise<string[]> {
  if (prompts.length === 0) return [];

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  const createResponse = await fetch(ANTHROPIC_BATCHES_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requests: prompts.map((prompt, index) => ({
        custom_id: `request-${index}`,
        params: buildAnthropicMessageParams(prompt, model, effort, maxTokens),
      })),
    }),
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text().catch(() => 'Unknown error');
    throw new Error(`Anthropic batch create error (${createResponse.status}): ${errorText}`);
  }

  let batch = await createResponse.json() as {
    id?: string;
    processing_status?: string;
    results_url?: string;
    request_counts?: { succeeded?: number; errored?: number; canceled?: number; expired?: number };
  };

  if (!batch.id) {
    throw new Error('Anthropic batch create response did not include an id');
  }

  console.log(`[digest] Anthropic batch ${batch.id} created (${prompts.length} requests)`);

  const deadline = Date.now() + ANTHROPIC_BATCH_POLL_TIMEOUT_MS;
  while (batch.processing_status !== 'ended') {
    if (Date.now() > deadline) {
      throw new Error(`Anthropic batch ${batch.id} timed out after ${ANTHROPIC_BATCH_POLL_TIMEOUT_MS / 60_000} minutes`);
    }

    await sleep(ANTHROPIC_BATCH_POLL_INTERVAL_MS);

    const statusResponse = await fetch(`${ANTHROPIC_BATCHES_API_URL}/${batch.id}`, { headers });
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text().catch(() => 'Unknown error');
      throw new Error(`Anthropic batch status error (${statusResponse.status}): ${errorText}`);
    }
    batch = await statusResponse.json() as typeof batch;

    const counts = batch.request_counts;
    const progress = counts ? ` (${counts.succeeded || 0} succeeded, ${counts.errored || 0} errored, ${counts.canceled || 0} canceled, ${counts.expired || 0} expired)` : '';
    console.log(`[digest] Anthropic batch ${batch.id}: ${batch.processing_status}${progress}`);
  }

  if (!batch.results_url) {
    throw new Error(`Anthropic batch ${batch.id} ended without a results URL`);
  }

  const resultsUrl = batch.results_url.startsWith('http')
    ? batch.results_url
    : `https://api.anthropic.com${batch.results_url}`;
  const resultsResponse = await fetch(resultsUrl, { headers });
  if (!resultsResponse.ok) {
    const errorText = await resultsResponse.text().catch(() => 'Unknown error');
    throw new Error(`Anthropic batch results error (${resultsResponse.status}): ${errorText}`);
  }

  const outputs = new Array<string>(prompts.length).fill('');
  const errors: string[] = [];
  const resultsText = await resultsResponse.text();

  for (const line of resultsText.split('\n')) {
    if (!line.trim()) continue;
    const item = JSON.parse(line) as {
      custom_id?: string;
      result?: {
        type?: string;
        message?: { content?: Array<{ type?: string; text?: string }> };
        error?: { type?: string; message?: string };
      };
    };

    const index = Number((item.custom_id || '').replace(/^request-/, ''));
    if (!Number.isInteger(index) || index < 0 || index >= outputs.length) {
      errors.push(`unexpected custom_id=${item.custom_id || 'missing'}`);
      continue;
    }

    if (item.result?.type === 'succeeded' && item.result.message) {
      outputs[index] = extractAnthropicText(item.result.message);
    } else {
      const error = item.result?.error;
      errors.push(`${item.custom_id}: ${error?.type || item.result?.type || 'unknown'} ${error?.message || ''}`.trim());
    }
  }

  if (errors.length > 0) {
    throw new Error(`Anthropic batch failed requests: ${errors.join('; ')}`);
  }

  return outputs;
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
      },
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }
  
  const data = await response.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAICompatible(
  prompt: string,
  apiKey: string,
  apiBase: string,
  model: string
): Promise<string> {
  const normalizedBase = apiBase.replace(/\/+$/, '');
  const response = await fetch(`${normalizedBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      top_p: 0.8,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenAI-compatible API error (${response.status}): ${errorText}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter(item => item.type === 'text' && typeof item.text === 'string')
      .map(item => item.text)
      .join('\n');
  }
  return '';
}

function inferOpenAIModel(apiBase: string): string {
  const base = apiBase.toLowerCase();
  if (base.includes('deepseek')) return 'deepseek-chat';
  return OPENAI_DEFAULT_MODEL;
}

function resolveAnthropicEffort(value?: string): AnthropicEffort {
  const effort = value?.trim();
  if (effort === 'low' || effort === 'medium' || effort === 'high' || effort === 'xhigh' || effort === 'max') {
    return effort;
  }
  return ANTHROPIC_DEFAULT_EFFORT;
}

function toAnthropicApiEffort(effort: AnthropicEffort): AnthropicApiEffort {
  return effort === 'xhigh' ? 'max' : effort;
}

function createAIClient(config: {
  anthropicApiKey?: string;
  anthropicModel?: string;
  anthropicEffort?: string;
  anthropicMaxTokens?: number;
  anthropicBatch?: boolean;
  geminiApiKey?: string;
  openaiApiKey?: string;
  openaiApiBase?: string;
  openaiModel?: string;
}): AIClient {
  const state = {
    anthropicApiKey: config.anthropicApiKey?.trim() || '',
    anthropicModel: config.anthropicModel?.trim() || ANTHROPIC_DEFAULT_MODEL,
    anthropicEffort: resolveAnthropicEffort(config.anthropicEffort),
    anthropicMaxTokens: config.anthropicMaxTokens || ANTHROPIC_DEFAULT_MAX_TOKENS,
    anthropicBatch: config.anthropicBatch ?? ANTHROPIC_DEFAULT_BATCH,
    geminiApiKey: config.geminiApiKey?.trim() || '',
    openaiApiKey: config.openaiApiKey?.trim() || '',
    openaiApiBase: (config.openaiApiBase?.trim() || OPENAI_DEFAULT_API_BASE).replace(/\/+$/, ''),
    openaiModel: config.openaiModel?.trim() || '',
    anthropicEnabled: Boolean(config.anthropicApiKey?.trim()),
    geminiEnabled: Boolean(config.geminiApiKey?.trim()),
    fallbackLogged: false,
  };

  if (!state.openaiModel) {
    state.openaiModel = inferOpenAIModel(state.openaiApiBase);
  }

  return {
    async call(prompt: string): Promise<string> {
      if (state.anthropicBatch && state.anthropicEnabled && state.anthropicApiKey) {
        const [result] = await this.callBatch([prompt]);
        return result || '';
      }

      if (state.anthropicEnabled && state.anthropicApiKey) {
        try {
          return await callAnthropic(
            prompt,
            state.anthropicApiKey,
            state.anthropicModel,
            state.anthropicEffort,
            state.anthropicMaxTokens
          );
        } catch (error) {
          if (state.geminiApiKey || state.openaiApiKey) {
            if (!state.fallbackLogged) {
              const reason = error instanceof Error ? error.message : String(error);
              console.warn(`[digest] Anthropic failed, switching to fallback provider. Reason: ${reason}`);
              state.fallbackLogged = true;
            }
            state.anthropicEnabled = false;
          } else {
            throw error;
          }
        }
      }

      if (state.geminiEnabled && state.geminiApiKey) {
        try {
          return await callGemini(prompt, state.geminiApiKey);
        } catch (error) {
          if (state.openaiApiKey) {
            if (!state.fallbackLogged) {
              const reason = error instanceof Error ? error.message : String(error);
              console.warn(`[digest] Gemini failed, switching to OpenAI-compatible fallback (${state.openaiApiBase}, model=${state.openaiModel}). Reason: ${reason}`);
              state.fallbackLogged = true;
            }
            state.geminiEnabled = false;
            return callOpenAICompatible(prompt, state.openaiApiKey, state.openaiApiBase, state.openaiModel);
          }
          throw error;
        }
      }

      if (state.openaiApiKey) {
        return callOpenAICompatible(prompt, state.openaiApiKey, state.openaiApiBase, state.openaiModel);
      }

      throw new Error('No AI API key configured. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, and/or OPENAI_API_KEY.');
    },

    async callBatch(prompts: string[]): Promise<string[]> {
      if (prompts.length === 0) return [];

      if (state.anthropicBatch && state.anthropicEnabled && state.anthropicApiKey) {
        try {
          return await callAnthropicBatch(
            prompts,
            state.anthropicApiKey,
            state.anthropicModel,
            state.anthropicEffort,
            state.anthropicMaxTokens
          );
        } catch (error) {
          if (state.geminiApiKey || state.openaiApiKey) {
            if (!state.fallbackLogged) {
              const reason = error instanceof Error ? error.message : String(error);
              console.warn(`[digest] Anthropic batch failed, switching to fallback provider. Reason: ${reason}`);
              state.fallbackLogged = true;
            }
            state.anthropicEnabled = false;
          } else {
            throw error;
          }
        }
      }

      return Promise.all(prompts.map(prompt => this.call(prompt)));
    },
  };
}

function parseJsonResponse<T>(text: string): T {
  let jsonText = text.trim();
  // Strip markdown code blocks if present
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  return JSON.parse(jsonText) as T;
}

function countTermMatches(text: string, terms: string[]): number {
  const normalized = text.toLowerCase();
  return terms.reduce((count, term) => count + (normalized.includes(term.toLowerCase()) ? 1 : 0), 0);
}

function calculateSelectionScore(
  article: Article,
  score: { relevance: number; quality: number; timeliness: number; category: CategoryId; keywords: string[] }
): number {
  const baseScore = score.relevance + score.quality + score.timeliness;
  const text = `${article.sourceName} ${article.title} ${article.description} ${score.keywords.join(' ')}`;
  const technicalMatches = countTermMatches(text, TECHNICAL_AI_INFRA_TERMS);
  const lowValueMatches = countTermMatches(text, LOW_VALUE_TOPIC_TERMS);
  const sourceBoost = TECHNICAL_AI_INFRA_SOURCES.has(article.sourceName) ? 4 : 0;
  const technicalBoost = Math.min(8, technicalMatches * 2);
  const lowValuePenalty = Math.min(8, lowValueMatches * 2);

  return baseScore
    + AI_INFRA_CATEGORY_BOOST[score.category]
    + sourceBoost
    + technicalBoost
    - lowValuePenalty;
}

function isQualitySelectionCandidate(candidate: RankedArticle): boolean {
  const { breakdown } = candidate;
  if (candidate.selectionScore < MIN_OUTPUT_SELECTION_SCORE) return false;
  if (breakdown.relevance < MIN_OUTPUT_RELEVANCE_SCORE) return false;
  if (breakdown.quality < MIN_OUTPUT_QUALITY_SCORE) return false;

  if (TARGET_OUTPUT_CATEGORIES.has(breakdown.category)) return true;

  const text = `${candidate.sourceName} ${candidate.title} ${candidate.description} ${breakdown.keywords.join(' ')}`;
  const technicalMatches = countTermMatches(text, TECHNICAL_AI_INFRA_TERMS);
  const sourceMatches = TECHNICAL_AI_INFRA_SOURCES.has(candidate.sourceName);

  if (breakdown.category === 'ai-ml') {
    return sourceMatches || technicalMatches >= 2;
  }

  if (breakdown.category === 'tools') {
    return technicalMatches >= 2 && (sourceMatches || breakdown.relevance >= 8);
  }

  return false;
}

function selectQualityArticles(candidates: RankedArticle[], topN: number): RankedArticle[] {
  return [...candidates]
    .filter(candidate => isQualitySelectionCandidate(candidate))
    .sort((a, b) => b.selectionScore - a.selectionScore)
    .slice(0, topN);
}

// ============================================================================
// AI Scoring
// ============================================================================

function buildScoringPrompt(articles: Array<{ index: number; title: string; description: string; sourceName: string }>): string {
  const articlesList = articles.map(a =>
    `Index ${a.index}: [${a.sourceName}] ${a.title}\n${a.description.slice(0, 300)}`
  ).join('\n\n---\n\n');

  return `You are a technology content curator preparing a daily digest for technical readers.

Score each article on three dimensions from 1 to 10, where 10 is best. Assign one category and extract 2 to 4 concise English keywords for each article.

## Audience Priority

The reader values deep technical AI infrastructure content. Strongly prioritize:
- production AI infrastructure, GPU clusters, model serving, deployment, reliability, and observability
- inference performance, latency, throughput, batching, KV cache, quantization, speculative decoding, and schedulers
- CUDA/Triton/GPU kernels, PyTorch internals, vLLM runtime updates, and systems-level AI performance work

Deprioritize policy/regulation/legal stories, industry drama, company politics, opinion essays, career/culture posts, general software engineering, and general security news. Include security only when it directly affects AI infrastructure, model serving, GPU runtimes, PyTorch/vLLM, or production ML systems.

## Scoring Dimensions

### 1. Relevance
- 10: Deep technical AI infrastructure, inference performance, CUDA/Triton kernels, PyTorch internals, vLLM, or production model-serving work
- 7-9: Useful AI systems work, LLM runtime, distributed training/serving, or performance analysis
- 4-6: General software engineering or AI/ML content without strong infrastructure depth
- 1-3: Policy, regulation, legal, opinion, security, culture, broad industry news, or general software engineering without direct AI infrastructure value

### 2. Quality
- 10: Deep analysis, original insight, strong evidence
- 7-9: Substantial and thoughtful
- 4-6: Accurate and clear
- 1-3: Shallow, repetitive, or mostly reposted material

### 3. Timeliness
- 10: Breaking or newly released and important now
- 7-9: Closely tied to current technical discussion
- 4-6: Evergreen and still useful
- 1-3: Outdated or not time-sensitive

## Categories
Choose exactly one. Prefer the most specific specialized category when there is overlap with AI / ML or tools.

- ai-ml: general AI, machine learning, LLMs, model research, evaluation, datasets, or deep learning that does not primarily focus on infrastructure or runtime systems
- ai-infra: AI infrastructure for production systems, GPU clusters, distributed training or serving platforms, model deployment, orchestration, observability, reliability, data/model pipelines, or model serving operations
- inference-performance: inference latency, throughput, serving efficiency, KV cache behavior, batching, quantization, speculative decoding, prefix caching, disaggregated prefill/decode, routing, scheduling, or cost/performance benchmarks
- cuda-kernels: CUDA, Triton, GPU kernels, warp-level programming, memory coalescing, tensor cores, FlashAttention-style kernels, cuDNN/cuBLAS, kernel fusion, or GPU profiling and optimization
- pytorch-ecosystem: PyTorch core, torch.compile, TorchInductor, ATen, torchao, torchtune, torchvision, torchtext, PyTorch distributed, PyTorch ecosystem projects, or PyTorch release updates
- vllm-updates: vLLM releases, vLLM internals, PagedAttention, vLLM model support, vLLM scheduler/runtime changes, vLLM plugins, vLLM benchmarks, or vLLM community updates
- security: security, privacy, vulnerabilities, or cryptography that directly affects AI infrastructure, model serving, GPU runtimes, PyTorch/vLLM, or production ML systems
- tools: developer tools, open-source projects, libraries, or framework releases that directly affect AI infrastructure, model serving, PyTorch/vLLM/CUDA, or production ML workflows
- opinion: industry analysis, personal essays, career topics, or culture
- other: none of the above

## Articles to Score

${articlesList}

Return strict JSON only. Do not include markdown code fences or any other text:
{
  "results": [
    {
      "index": 0,
      "relevance": 8,
      "quality": 7,
      "timeliness": 9,
      "category": "inference-performance",
      "keywords": ["batching", "latency", "model serving"]
    }
  ]
}`;
}

async function scoreArticlesWithAI(
  articles: Article[],
  aiClient: AIClient
): Promise<Map<number, { relevance: number; quality: number; timeliness: number; category: CategoryId; keywords: string[] }>> {
  const allScores = new Map<number, { relevance: number; quality: number; timeliness: number; category: CategoryId; keywords: string[] }>();
  
  const indexed = articles.map((article, index) => ({
    index,
    title: article.title,
    description: article.description,
    sourceName: article.sourceName,
  }));
  
  const batches: typeof indexed[] = [];
  for (let i = 0; i < indexed.length; i += GEMINI_BATCH_SIZE) {
    batches.push(indexed.slice(i, i + GEMINI_BATCH_SIZE));
  }
  
  console.log(`[digest] AI scoring: ${articles.length} articles in ${batches.length} batches`);
  
  const validCategories = new Set<string>(Object.keys(CATEGORY_META));

  const setDefaultScores = (batch: typeof indexed) => {
    for (const item of batch) {
      allScores.set(item.index, { relevance: 5, quality: 5, timeliness: 5, category: 'other', keywords: [] });
    }
  };

  try {
    const prompts = batches.map(batch => buildScoringPrompt(batch));
    const responseTexts = await aiClient.callBatch(prompts);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      try {
        const responseText = responseTexts[i] || '';
        const parsed = parseJsonResponse<GeminiScoringResult>(responseText);
        
        if (parsed.results && Array.isArray(parsed.results)) {
          for (const result of parsed.results) {
            const clamp = (v: number) => Math.min(10, Math.max(1, Math.round(v)));
            const cat = (validCategories.has(result.category) ? result.category : 'other') as CategoryId;
            allScores.set(result.index, {
              relevance: clamp(result.relevance),
              quality: clamp(result.quality),
              timeliness: clamp(result.timeliness),
              category: cat,
              keywords: Array.isArray(result.keywords) ? result.keywords.slice(0, 4) : [],
            });
          }
        }
      } catch (error) {
        console.warn(`[digest] Scoring batch failed: ${error instanceof Error ? error.message : String(error)}`);
        setDefaultScores(batch);
      }
    }
  } catch (error) {
    console.warn(`[digest] Scoring request failed: ${error instanceof Error ? error.message : String(error)}`);
    for (const batch of batches) {
      setDefaultScores(batch);
    }
  }

  console.log(`[digest] Scoring progress: ${batches.length}/${batches.length} batches`);
  
  return allScores;
}

// ============================================================================
// AI Summarization
// ============================================================================

function buildSummaryPrompt(
  articles: Array<{ index: number; title: string; description: string; sourceName: string; link: string }>,
  lang: OutputLanguage
): string {
  const articlesList = articles.map(a =>
    `Index ${a.index}: [${a.sourceName}] ${a.title}\nURL: ${a.link}\n${a.description.slice(0, 800)}`
  ).join('\n\n---\n\n');

  const langInstruction = 'Write every field in English.';

  return `You are a technical content summarization expert. For each article, produce three fields:

1. **Display title** (displayTitle): a clear English title. If the original title is already clear English, keep it.
2. **Summary** (summary): a structured 4 to 6 sentence summary that lets readers understand the article without opening it. Include:
   - the core problem or topic
   - the key argument, technical approach, or finding
   - the conclusion or main author viewpoint
3. **Reason** (reason): one sentence explaining why the article is worth reading. This should explain why it matters, not repeat what it says.

${langInstruction}

Summary requirements:
- Start with the point. Do not use filler openings like "This article discusses..."
- Include concrete technical terms, data, names, or arguments where available.
- Preserve important numbers, metrics, versions, and comparisons.
- If the article compares options, state what is being compared and the conclusion.
- The reader should be able to decide in 30 seconds whether the full article is worth reading.

## Articles to Summarize

${articlesList}

Return strict JSON only:
{
  "results": [
    {
      "index": 0,
      "displayTitle": "English display title",
      "summary": "Summary text...",
      "reason": "Reason text..."
    }
  ]
}`;
}

async function summarizeArticles(
  articles: Array<Article & { index: number }>,
  aiClient: AIClient,
  lang: OutputLanguage
): Promise<Map<number, { displayTitle: string; summary: string; reason: string }>> {
  const summaries = new Map<number, { displayTitle: string; summary: string; reason: string }>();
  
  const indexed = articles.map(a => ({
    index: a.index,
    title: a.title,
    description: a.description,
    sourceName: a.sourceName,
    link: a.link,
  }));
  
  const batches: typeof indexed[] = [];
  for (let i = 0; i < indexed.length; i += GEMINI_BATCH_SIZE) {
    batches.push(indexed.slice(i, i + GEMINI_BATCH_SIZE));
  }
  
  console.log(`[digest] Generating summaries for ${articles.length} articles in ${batches.length} batches`);

  const setDefaultSummaries = (batch: typeof indexed) => {
    for (const item of batch) {
      summaries.set(item.index, { displayTitle: item.title, summary: item.title, reason: '' });
    }
  };

  try {
    const prompts = batches.map(batch => buildSummaryPrompt(batch, lang));
    const responseTexts = await aiClient.callBatch(prompts);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]!;
      try {
        const responseText = responseTexts[i] || '';
        const parsed = parseJsonResponse<GeminiSummaryResult>(responseText);
        
        if (parsed.results && Array.isArray(parsed.results)) {
          for (const result of parsed.results) {
            summaries.set(result.index, {
              displayTitle: result.displayTitle || '',
              summary: result.summary || '',
              reason: result.reason || '',
            });
          }
        }
      } catch (error) {
        console.warn(`[digest] Summary batch failed: ${error instanceof Error ? error.message : String(error)}`);
        setDefaultSummaries(batch);
      }
    }
  } catch (error) {
    console.warn(`[digest] Summary request failed: ${error instanceof Error ? error.message : String(error)}`);
    for (const batch of batches) {
      setDefaultSummaries(batch);
    }
  }

  console.log(`[digest] Summary progress: ${batches.length}/${batches.length} batches`);
  
  return summaries;
}

// ============================================================================
// AI Highlights (Today's Trends)
// ============================================================================

async function generateHighlights(
  articles: ScoredArticle[],
  aiClient: AIClient,
  lang: OutputLanguage
): Promise<string> {
  const articleList = articles.slice(0, 10).map((a, i) =>
    `${i + 1}. [${a.category}] ${a.displayTitle || a.title} — ${a.summary.slice(0, 100)}`
  ).join('\n');

  const langNote = 'Write in English.';

  const prompt = `Write a 3 to 5 sentence highlights section for the following selected technology articles.
Requirements:
- Identify 2 to 3 major themes or trends.
- Do not list articles one by one; synthesize the bigger picture.
- Use a concise news-lede style.
${langNote}

Articles:
${articleList}

  Return plain text only. Do not return JSON or markdown.`;

  try {
    const [text] = await aiClient.callBatch([prompt]);
    return (text || '').trim();
  } catch (error) {
    console.warn(`[digest] Highlights generation failed: ${error instanceof Error ? error.message : String(error)}`);
    return '';
  }
}

// ============================================================================
// Visualization Helpers
// ============================================================================

function humanizeTime(pubDate: Date): string {
  const diffMs = Date.now() - pubDate.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  return pubDate.toISOString().slice(0, 10);
}

function generateKeywordBarChart(articles: ScoredArticle[]): string {
  const kwCount = new Map<string, number>();
  for (const a of articles) {
    for (const kw of a.keywords) {
      const normalized = kw.toLowerCase();
      kwCount.set(normalized, (kwCount.get(normalized) || 0) + 1);
    }
  }

  const sorted = Array.from(kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (sorted.length === 0) return '';

  const labels = sorted.map(([k]) => `"${k}"`).join(', ');
  const values = sorted.map(([, v]) => v).join(', ');
  const maxVal = sorted[0][1];

  let chart = '```mermaid\n';
  chart += `xychart-beta horizontal\n`;
  chart += `    title "Frequent Keywords"\n`;
  chart += `    x-axis [${labels}]\n`;
  chart += `    y-axis "Count" 0 --> ${maxVal + 2}\n`;
  chart += `    bar [${values}]\n`;
  chart += '```\n';

  return chart;
}

function generateCategoryPieChart(articles: ScoredArticle[]): string {
  const catCount = new Map<CategoryId, number>();
  for (const a of articles) {
    catCount.set(a.category, (catCount.get(a.category) || 0) + 1);
  }

  if (catCount.size === 0) return '';

  const sorted = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1]);

  let chart = '```mermaid\n';
  chart += `pie showData\n`;
  chart += `    title "Article Category Distribution"\n`;
  for (const [cat, count] of sorted) {
    const meta = CATEGORY_META[cat];
    chart += `    "${meta.emoji} ${meta.label}" : ${count}\n`;
  }
  chart += '```\n';

  return chart;
}

function generateAsciiBarChart(articles: ScoredArticle[]): string {
  const kwCount = new Map<string, number>();
  for (const a of articles) {
    for (const kw of a.keywords) {
      const normalized = kw.toLowerCase();
      kwCount.set(normalized, (kwCount.get(normalized) || 0) + 1);
    }
  }

  const sorted = Array.from(kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  if (sorted.length === 0) return '';

  const maxVal = sorted[0][1];
  const maxBarWidth = 20;
  const maxLabelLen = Math.max(...sorted.map(([k]) => k.length));

  let chart = '```\n';
  for (const [label, value] of sorted) {
    const barLen = Math.max(1, Math.round((value / maxVal) * maxBarWidth));
    const bar = '#'.repeat(barLen) + '-'.repeat(maxBarWidth - barLen);
    chart += `${label.padEnd(maxLabelLen)} | ${bar} ${value}\n`;
  }
  chart += '```\n';

  return chart;
}

function generateTagCloud(articles: ScoredArticle[]): string {
  const kwCount = new Map<string, number>();
  for (const a of articles) {
    for (const kw of a.keywords) {
      const normalized = kw.toLowerCase();
      kwCount.set(normalized, (kwCount.get(normalized) || 0) + 1);
    }
  }

  const sorted = Array.from(kwCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  if (sorted.length === 0) return '';

  return sorted
    .map(([word, count], i) => i < 3 ? `**${word}**(${count})` : `${word}(${count})`)
    .join(' · ');
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

// ============================================================================
// Report Generation
// ============================================================================

function generateDigestReport(articles: ScoredArticle[], highlights: string, stats: {
  totalFeeds: number;
  successFeeds: number;
  totalArticles: number;
  filteredArticles: number;
  hours: number;
  lang: string;
  failedFeeds: FeedFailure[];
}): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  let report = `# AI Daily Digest - ${dateStr}\n\n`;
  report += `> ${articles.length} AI-selected article${articles.length === 1 ? '' : 's'} from ${stats.totalFeeds} curated technology feeds.\n\n`;

  // ── Today's Highlights ──
  if (highlights) {
    report += `## Highlights\n\n`;
    report += `${highlights}\n\n`;
    report += `---\n\n`;
  }

  // ── Top 3 Deep Showcase ──
  if (articles.length >= 3) {
    report += `## Top Reads\n\n`;
    for (let i = 0; i < Math.min(3, articles.length); i++) {
      const a = articles[i];
      const medal = ['🥇', '🥈', '🥉'][i];
      const catMeta = CATEGORY_META[a.category];
      
      report += `${medal} **${a.displayTitle || a.title}**\n\n`;
      report += `[${a.title}](${a.link}) — ${a.sourceName} · ${humanizeTime(a.pubDate)} · ${catMeta.emoji} ${catMeta.label}\n\n`;
      report += `Original link: <${a.link}>\n\n`;
      report += `> ${a.summary}\n\n`;
      if (a.reason) {
        report += `💡 **Why it matters**: ${a.reason}\n\n`;
      }
      if (a.keywords.length > 0) {
        report += `🏷️ ${a.keywords.join(', ')}\n\n`;
      }
    }
    report += `---\n\n`;
  }

  // ── Visual Statistics ──
  report += `## Data Overview\n\n`;

  report += `| Feeds | Articles | Time Range | Selected |\n`;
  report += `|:---:|:---:|:---:|:---:|\n`;
  report += `| ${stats.successFeeds}/${stats.totalFeeds} | ${stats.totalArticles} -> ${stats.filteredArticles} | ${stats.hours}h | **${articles.length}** |\n\n`;

  if (stats.failedFeeds.length > 0) {
    report += `## Failed Feeds\n\n`;
    report += `| Source | Issue | Feed URL |\n`;
    report += `|---|---|---|\n`;
    for (const failure of stats.failedFeeds) {
      report += `| ${escapeMarkdownTableCell(failure.name)} | ${escapeMarkdownTableCell(failure.reason)} | <${failure.xmlUrl}> |\n`;
    }
    report += `\n`;
  }

  const pieChart = generateCategoryPieChart(articles);
  if (pieChart) {
    report += `### Category Distribution\n\n${pieChart}\n`;
  }

  const barChart = generateKeywordBarChart(articles);
  if (barChart) {
    report += `### Frequent Keywords\n\n${barChart}\n`;
  }

  const asciiChart = generateAsciiBarChart(articles);
  if (asciiChart) {
    report += `<details>\n<summary>Plain-text keyword chart</summary>\n\n${asciiChart}\n</details>\n\n`;
  }

  const tagCloud = generateTagCloud(articles);
  if (tagCloud) {
    report += `### Tags\n\n${tagCloud}\n\n`;
  }

  report += `---\n\n`;

  // ── Category-Grouped Articles ──
  const categoryGroups = new Map<CategoryId, ScoredArticle[]>();
  for (const a of articles) {
    const list = categoryGroups.get(a.category) || [];
    list.push(a);
    categoryGroups.set(a.category, list);
  }

  const sortedCategories = Array.from(categoryGroups.entries())
    .sort((a, b) => b[1].length - a[1].length);

  let globalIndex = 0;
  for (const [catId, catArticles] of sortedCategories) {
    const catMeta = CATEGORY_META[catId];
    report += `## ${catMeta.emoji} ${catMeta.label}\n\n`;

    for (const a of catArticles) {
      globalIndex++;
      const scoreTotal = a.scoreBreakdown.relevance + a.scoreBreakdown.quality + a.scoreBreakdown.timeliness;

      report += `### ${globalIndex}. ${a.displayTitle || a.title}\n\n`;
      report += `[${a.title}](${a.link}) — **${a.sourceName}** · ${humanizeTime(a.pubDate)} · ⭐ ${scoreTotal}/30\n\n`;
      report += `Original link: <${a.link}>\n\n`;
      report += `> ${a.summary}\n\n`;
      if (a.keywords.length > 0) {
        report += `🏷️ ${a.keywords.join(', ')}\n\n`;
      }
      report += `---\n\n`;
    }
  }

  // ── Footer ──
  report += `*Generated at ${dateStr} ${now.toISOString().split('T')[1]?.slice(0, 5) || ''} | scanned ${stats.successFeeds} feeds | fetched ${stats.totalArticles} articles | selected ${articles.length} articles*\n`;
  report += `*Based on Hacker News-popular technology feeds plus selected additional sources.*\n`;

  return report;
}

// ============================================================================
// CLI
// ============================================================================

function printUsage(): never {
  console.log(`AI Daily Digest - AI-powered RSS digest from curated tech blogs

Usage:
  bun scripts/digest.ts [options]

Options:
  --hours <n>     Time range in hours (default: 48)
  --top-n <n>     Maximum articles to include after quality filtering (default: ${DEFAULT_TOP_N})
  --lang <lang>   Summary language: en (default: en)
  --output <path> Output file path (default: ./digest-YYYYMMDD.md)
  --help          Show this help

Environment:
  ANTHROPIC_API_KEY Primary key for Anthropic Messages API
  ANTHROPIC_MODEL   Optional Anthropic model (default: ${ANTHROPIC_DEFAULT_MODEL})
  ANTHROPIC_EFFORT  Optional Anthropic effort: low, medium, high, xhigh, max (default: ${ANTHROPIC_DEFAULT_EFFORT})
  ANTHROPIC_MAX_TOKENS Optional Anthropic max_tokens (default: ${ANTHROPIC_DEFAULT_MAX_TOKENS})
  ANTHROPIC_BATCH   Optional Anthropic Message Batches mode: true/false (default: ${ANTHROPIC_DEFAULT_BATCH})
  GEMINI_API_KEY    Optional fallback key. Get one at https://aistudio.google.com/apikey
  OPENAI_API_KEY    Optional fallback key for OpenAI-compatible APIs
  OPENAI_API_BASE   Optional fallback base URL (default: https://api.openai.com/v1)
  OPENAI_MODEL      Optional fallback model (default: deepseek-chat for DeepSeek base, else gpt-4o-mini)

Examples:
  ANTHROPIC_BATCH=true bun scripts/digest.ts --hours 24 --top-n 25 --lang en
  bun scripts/digest.ts --hours 72 --top-n 25 --lang en --output ./my-digest.md
`);
  process.exit(0);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) printUsage();
  
  let hours = 48;
  let topN = DEFAULT_TOP_N;
  let lang: OutputLanguage = 'en';
  let outputPath = '';
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--hours' && args[i + 1]) {
      hours = parseInt(args[++i]!, 10);
    } else if (arg === '--top-n' && args[i + 1]) {
      topN = parseInt(args[++i]!, 10);
    } else if (arg === '--lang' && args[i + 1]) {
      args[++i];
      lang = 'en';
    } else if (arg === '--output' && args[i + 1]) {
      outputPath = args[++i]!;
    }
  }
  
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const anthropicModel = process.env.ANTHROPIC_MODEL;
  const anthropicEffort = process.env.ANTHROPIC_EFFORT;
  const anthropicMaxTokens = process.env.ANTHROPIC_MAX_TOKENS ? parseInt(process.env.ANTHROPIC_MAX_TOKENS, 10) : undefined;
  const anthropicBatch = parseBooleanEnv(process.env.ANTHROPIC_BATCH, ANTHROPIC_DEFAULT_BATCH);
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const openaiApiBase = process.env.OPENAI_API_BASE;
  const openaiModel = process.env.OPENAI_MODEL;

  if (!anthropicApiKey && !geminiApiKey && !openaiApiKey) {
    console.error('[digest] Error: Missing API key. Set ANTHROPIC_API_KEY, GEMINI_API_KEY, and/or OPENAI_API_KEY.');
    console.error('[digest] Anthropic key: https://console.anthropic.com/settings/keys');
    process.exit(1);
  }

  const aiClient = createAIClient({
    anthropicApiKey,
    anthropicModel,
    anthropicEffort,
    anthropicMaxTokens,
    anthropicBatch,
    geminiApiKey,
    openaiApiKey,
    openaiApiBase,
    openaiModel,
  });
  
  if (!outputPath) {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    outputPath = `./digest-${dateStr}.md`;
  }
  
  console.log(`[digest] === AI Daily Digest ===`);
  console.log(`[digest] Time range: ${hours} hours`);
  console.log(`[digest] Top N: ${topN}`);
  console.log(`[digest] Language: ${lang}`);
  console.log(`[digest] Output: ${outputPath}`);
  console.log(`[digest] AI provider: ${anthropicApiKey ? `Anthropic (primary, model=${anthropicModel?.trim() || ANTHROPIC_DEFAULT_MODEL}, effort=${resolveAnthropicEffort(anthropicEffort)}, batch=${anthropicBatch ? 'on' : 'off'})` : geminiApiKey ? 'Gemini (primary)' : 'OpenAI-compatible (primary)'}`);
  if (openaiApiKey) {
    const resolvedBase = (openaiApiBase?.trim() || OPENAI_DEFAULT_API_BASE).replace(/\/+$/, '');
    const resolvedModel = openaiModel?.trim() || inferOpenAIModel(resolvedBase);
    console.log(`[digest] Fallback: ${resolvedBase} (model=${resolvedModel})`);
  }
  console.log('');
  
  console.log(`[digest] Step 1/5: Fetching ${RSS_FEEDS.length} RSS feeds...`);
  const feedSummary = await fetchAllFeeds(RSS_FEEDS);
  const allArticles = feedSummary.articles;
  
  if (allArticles.length === 0) {
    console.error('[digest] Error: No articles fetched from any feed. Check network connection.');
    process.exit(1);
  }
  
  console.log(`[digest] Step 2/5: Filtering by time range (${hours} hours)...`);
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
  const recentArticles = allArticles.filter(a => a.pubDate.getTime() > cutoffTime.getTime());
  
  console.log(`[digest] Found ${recentArticles.length} articles within last ${hours} hours`);
  
  if (recentArticles.length === 0) {
    console.error(`[digest] Error: No articles found within the last ${hours} hours.`);
    console.error(`[digest] Try increasing --hours (e.g., --hours 168 for one week)`);
    process.exit(1);
  }
  
  console.log(`[digest] Step 3/5: AI scoring ${recentArticles.length} articles...`);
  const scores = await scoreArticlesWithAI(recentArticles, aiClient);
  
  const scoredArticles: RankedArticle[] = recentArticles.map((article, index) => {
    const score = scores.get(index) || { relevance: 5, quality: 5, timeliness: 5, category: 'other' as CategoryId, keywords: [] };
    const baseScore = score.relevance + score.quality + score.timeliness;
    const selectionScore = calculateSelectionScore(article, score);
    return {
      ...article,
      totalScore: baseScore,
      selectionScore,
      breakdown: score,
    };
  });
  
  const topArticles = selectQualityArticles(scoredArticles, topN);
  const scoreRange = topArticles.length > 0
    ? `${topArticles[topArticles.length - 1]!.selectionScore} - ${topArticles[0]!.selectionScore}`
    : 'none';
  
  console.log(`[digest] ${topArticles.length}/${topN} quality articles selected after AI infra filtering (selection score range: ${scoreRange})`);
  if (topArticles.length === 0) {
    console.warn('[digest] No articles met the quality threshold; writing a digest with stats and failed-feed data only.');
  }
  
  console.log(`[digest] Step 4/5: Generating AI summaries...`);
  const indexedTopArticles = topArticles.map((a, i) => ({ ...a, index: i }));
  const summaries = await summarizeArticles(indexedTopArticles, aiClient, lang);
  
  const finalArticles: ScoredArticle[] = topArticles.map((a, i) => {
    const sm = summaries.get(i) || { displayTitle: a.title, summary: a.description.slice(0, 200), reason: '' };
    return {
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      description: a.description,
      sourceName: a.sourceName,
      sourceUrl: a.sourceUrl,
      score: a.totalScore,
      selectionScore: a.selectionScore,
      scoreBreakdown: {
        relevance: a.breakdown.relevance,
        quality: a.breakdown.quality,
        timeliness: a.breakdown.timeliness,
      },
      category: a.breakdown.category,
      keywords: a.breakdown.keywords,
      displayTitle: sm.displayTitle,
      summary: sm.summary,
      reason: sm.reason,
    };
  });
  
  console.log(`[digest] Step 5/5: Generating today's highlights...`);
  const highlights = finalArticles.length > 0
    ? await generateHighlights(finalArticles, aiClient, lang)
    : '';
  
  const report = generateDigestReport(finalArticles, highlights, {
    totalFeeds: RSS_FEEDS.length,
    successFeeds: feedSummary.successCount,
    totalArticles: allArticles.length,
    filteredArticles: recentArticles.length,
    hours,
    lang,
    failedFeeds: feedSummary.failedFeeds,
  });
  
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, report);
  
  console.log('');
  console.log(`[digest] ✅ Done!`);
  console.log(`[digest] 📁 Report: ${outputPath}`);
  console.log(`[digest] 📊 Stats: ${feedSummary.successCount} sources -> ${allArticles.length} articles -> ${recentArticles.length} recent -> ${finalArticles.length} selected (${feedSummary.failCount} failed feeds)`);
  
  if (finalArticles.length > 0) {
    console.log('');
    console.log(`[digest] 🏆 Top 3 Preview:`);
    for (let i = 0; i < Math.min(3, finalArticles.length); i++) {
      const a = finalArticles[i];
      console.log(`  ${i + 1}. ${a.displayTitle || a.title}`);
      console.log(`     ${a.summary.slice(0, 80)}...`);
    }
  }
}

await main().catch((err) => {
  console.error(`[digest] Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
