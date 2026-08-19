import { test } from "bun:test";

// Refresh 2026-08-19T03:48Z so GitHub emits fresh short-lived attachment tokens.
const body = String.raw`
<img src="https://github.com/user-attachments/assets/b8d9a3c4-6647-4b2b-a1c5-ae4b6ebde473" />
<img src="https://github.com/user-attachments/assets/a1545cd2-6c9a-45d8-8364-9a43e6befded" />
<img src="https://github.com/user-attachments/assets/e44552d1-ca23-4a72-9f1a-eac1ab682dea" />
<img src="https://github.com/user-attachments/assets/d9d99056-58f6-497b-8994-58a36847129e" />
`;

test("temporary: resolve Issue #361 attachment URLs", async () => {
  const response = await fetch("https://api.github.com/markdown", {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "plasmon-issue361-attachment-resolver",
    },
    body: JSON.stringify({ text: body, context: "plasmon-cloud/plasmon", mode: "gfm" }),
  });
  if (!response.ok) throw new Error(`GitHub markdown render failed: ${response.status} ${await response.text()}`);
  const rendered = await response.text();
  const urls = [...rendered.matchAll(/<img src="(https:\/\/private-user-images\.githubusercontent\.com\/[^"]+)"/g)]
    .map((match) => match[1]);
  if (urls.length !== 4) throw new Error(`Expected 4 resolved images, got ${urls.length}`);
  urls.forEach((url, index) => {
    console.log(`ISSUE361_IMAGE_${index + 1}_BASE64=${Buffer.from(url, "utf8").toString("base64")}`);
  });
});
