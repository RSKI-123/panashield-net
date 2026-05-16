import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const dataPath = path.join(repoRoot, "assets", "data", "products.json");
const outDir = path.join(repoRoot, "assets", "images", "products");
const manifestPath = path.join(repoRoot, "assets", "data", "product-images.local.json");
const concurrency = Number(process.env.IMAGE_DOWNLOAD_CONCURRENCY || 16);
const timeoutMs = Number(process.env.IMAGE_DOWNLOAD_TIMEOUT_MS || 45000);
const retries = Number(process.env.IMAGE_DOWNLOAD_RETRIES || 3);

const isRemoteImage = (value) =>
  typeof value === "string" &&
  /^https?:\/\//i.test(value) &&
  /\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(value);

const extensionForUrl = (url) => {
  const pathname = new URL(url).pathname.toLowerCase();
  const match = pathname.match(/\.(jpe?g|png|webp|gif)$/i);
  if (!match) return ".jpg";
  return match[1].toLowerCase() === "jpeg" ? ".jpg" : `.${match[1].toLowerCase()}`;
};

const localPathForUrl = (url) => {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 20);
  return `assets/images/products/${hash}${extensionForUrl(url)}`;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const collectUrls = (value, urls = new Set()) => {
  if (isRemoteImage(value)) {
    urls.add(value);
    return urls;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, urls);
    return urls;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectUrls(item, urls);
  }
  return urls;
};

const replaceUrls = (value, map) => {
  if (isRemoteImage(value) && map.has(value)) return map.get(value);
  if (Array.isArray(value)) return value.map((item) => replaceUrls(item, map));
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      value[key] = replaceUrls(item, map);
    }
  }
  return value;
};

const fileExists = async (filePath) => {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
};

const downloadBytesWithTimeout = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
};

const downloadOne = async (url, relativePath) => {
  const targetPath = path.join(repoRoot, relativePath);
  if (await fileExists(targetPath)) return { status: "skipped", url, relativePath };

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const tempPath = `${targetPath}.download`;

  let lastError = "";
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const bytes = await downloadBytesWithTimeout(url);
      if (bytes.length === 0) throw new Error("empty response");
      await fs.writeFile(tempPath, bytes);
      await fs.rename(tempPath, targetPath);
      return { status: "downloaded", url, relativePath, bytes: bytes.length };
    } catch (error) {
      lastError = error?.message || String(error);
      await fs.rm(tempPath, { force: true }).catch(() => {});
      await sleep(500 * attempt);
    }
  }

  return { status: "failed", url, relativePath, error: lastError };
};

const runPool = async (items, worker) => {
  let index = 0;
  const results = [];
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await worker(items[current], current);
    }
  });
  await Promise.all(workers);
  return results;
};

const data = JSON.parse(await fs.readFile(dataPath, "utf8"));
const urls = [...collectUrls(data)].sort();
const urlMap = new Map(urls.map((url) => [url, localPathForUrl(url)]));

console.log(`Found ${urls.length} unique remote images.`);
await fs.mkdir(outDir, { recursive: true });

let downloaded = 0;
let skipped = 0;
let failed = 0;
let totalBytes = 0;

const results = await runPool(urls, async (url, index) => {
  const result = await downloadOne(url, urlMap.get(url));
  if (result.status === "downloaded") {
    downloaded += 1;
    totalBytes += result.bytes || 0;
  } else if (result.status === "skipped") {
    skipped += 1;
  } else {
    failed += 1;
  }

  const done = index + 1;
  if (done % 25 === 0 || done === urls.length || result.status === "failed") {
    console.log(
      `Progress ${done}/${urls.length} downloaded=${downloaded} skipped=${skipped} failed=${failed} bytes=${totalBytes}`,
    );
  }
  if (result.status === "failed") {
    console.log(`FAILED ${url} -> ${result.error}`);
  }
  return result;
});

const successfulUrls = new Set(
  results.filter((result) => result.status !== "failed").map((result) => result.url),
);
const successfulMap = new Map([...urlMap].filter(([url]) => successfulUrls.has(url)));
replaceUrls(data, successfulMap);
data.updatedAt = new Date().toISOString();

await fs.writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
await fs.writeFile(
  manifestPath,
  `${JSON.stringify(
    {
      updatedAt: new Date().toISOString(),
      source: "assets/data/products.json",
      totalRemoteImages: urls.length,
      localizedImages: successfulMap.size,
      failedImages: results.filter((result) => result.status === "failed"),
      images: Object.fromEntries(urlMap),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(
  `Done. localized=${successfulMap.size}/${urls.length} downloaded=${downloaded} skipped=${skipped} failed=${failed}`,
);
if (failed > 0) process.exitCode = 1;
