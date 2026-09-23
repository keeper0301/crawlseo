import {
  crawlerUserAgentForUrl,
  isVercelChallenge,
} from "@/lib/crawler/engine";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const peonchiUa = crawlerUserAgentForUrl("https://peonchi.com/robots.txt");
assert(peonchiUa.includes("Chrome/"), "Peonchi must use the browser-compatible audit UA");
assert(peonchiUa.includes("CrawlSEO-Audit/1.0"), "Audit UA must remain identifiable");

const keepiooUa = crawlerUserAgentForUrl("https://www.keepioo.com/");
assert(keepiooUa.startsWith("CrawlSEOBot/1.0"), "Other sites must retain the standard crawler UA");

assert(isVercelChallenge(429, "challenge"), "Vercel challenge must be detected");
assert(!isVercelChallenge(404, null), "Ordinary 404 must not be classified as a challenge");
assert(!isVercelChallenge(429, null), "429 without mitigation header is not a Vercel challenge");

console.log("crawler access policy tests passed");
