import { test } from "bun:test";
import { mkdir, writeFile } from "node:fs/promises";

// Trigger after the temporary workflow gained artifact upload support.
const body = String.raw`
<img src="https://github.com/user-attachments/assets/b8d9a3c4-6647-4b2b-a1c5-ae4b6ebde473" />
<img src="https://github.com/user-attachments/assets/a1545cd2-6c9a-45d8-8364-9a43e6befded" />
<img src="https://github.com/user-attachments/assets/e44552d1-ca23-4a72-9f1a-eac1ab682dea" />
<img src="https://github.com/user-attachments/assets/d9d99056-58f6-497b-8994-58a36847129e" />
`;

test("temporary: download Issue #361 attachment images", async () => {
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

  const output = "/tmp/issue361-images";
  await mkdir(output, { recursive: true });
  for (const [index, url] of urls.entries()) {
    const image = await fetch(url);
    if (!image.ok) throw new Error(`Attachment ${index + 1} download failed: ${image.status}`);
    const bytes = new Uint8Array(await image.arrayBuffer());
    await writeFile(`${output}/${index + 1}.png`, bytes);
    console.log(`ISSUE361_IMAGE_${index + 1}_BYTES=${bytes.length}`);
  }
});
