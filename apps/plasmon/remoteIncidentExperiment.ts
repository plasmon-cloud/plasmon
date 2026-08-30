import { readFile } from "node:fs/promises";

const API = "https://api.rollbar.com/api/1";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function readJson(url: string, token: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "X-Rollbar-Access-Token": token },
  });
  if (!response.ok) throw new Error(`Rollbar API ${response.status}: ${await response.text()}`);
  return response.json();
}

async function verifyReadApi(): Promise<void> {
  const token = required("ROLLBAR_READ_TOKEN");
  const environment = process.env.ROLLBAR_ENVIRONMENT ?? "plasmon-full";
  const projectId = process.env.ROLLBAR_PROJECT_ID;
  const suffix = new URLSearchParams({ environment, status: "active" });
  suffix.append("level", "error");
  suffix.append("level", "critical");
  if (projectId) suffix.set("project_id", projectId);

  const items = await readJson(`${API}/items?${suffix}`, token) as {
    result?: { items?: Array<{ id?: number; title?: string }> };
  };
  const item = items.result?.items?.[0];
  if (!item?.id) throw new Error(`No active Rollbar item found in ${environment}`);
  const itemSuffix = projectId ? `?project_id=${encodeURIComponent(projectId)}` : "";
  const [details, occurrences] = await Promise.all([
    readJson(`${API}/item/${item.id}${itemSuffix}`, token),
    readJson(`${API}/item/${item.id}/instances${itemSuffix}`, token),
  ]);

  console.log(JSON.stringify({ selectedItem: item, details, occurrences }, null, 2));
}

async function uploadSourceMap(): Promise<void> {
  const token = required("ROLLBAR_POST_SERVER_TOKEN");
  const releaseSha = required("PLASMON_BUILD_SHA");
  const minifiedUrl = required("ROLLBAR_MINIFIED_URL");
  const mapPath = process.env.ROLLBAR_SOURCE_MAP ?? ".remote-sourcemaps/main.js.map";
  const bytes = await readFile(mapPath);
  const parsed = JSON.parse(bytes.toString("utf8")) as { sources?: string[]; sourcesContent?: unknown[] };
  const includesSources = Array.isArray(parsed.sourcesContent) && parsed.sourcesContent.length > 0;
  if (!includesSources) {
    throw new Error(
      "Source map omits sourcesContent. Rollbar requires the referenced source files to be uploaded separately; this experiment refuses an incomplete upload.",
    );
  }

  const body = new FormData();
  body.set("version", releaseSha);
  body.set("minified_url", minifiedUrl);
  body.set("source_map", new Blob([bytes], { type: "application/json" }), "main.js.map");
  const response = await fetch(`${API}/sourcemap`, {
    method: "POST",
    headers: { "X-Rollbar-Access-Token": token },
    body,
  });
  if (!response.ok) throw new Error(`Rollbar source map upload ${response.status}: ${await response.text()}`);
  console.log(`Uploaded ${mapPath} for ${releaseSha} -> ${minifiedUrl}`);
}

const command = process.argv[2];
if (command === "read") await verifyReadApi();
else if (command === "upload-sourcemap") await uploadSourceMap();
else throw new Error("Usage: bun remoteIncidentExperiment.ts read|upload-sourcemap");
