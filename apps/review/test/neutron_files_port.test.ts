import { expect, test } from "bun:test";
import { NeutronFilesPort } from "../src/neutron_files_port.ts";

const ETAG = "980d24410f2cf3ee29cdf95f32adcb462fbe01be1d46817c7d74fec5b7bd5bde";

function reviewBytes(): ArrayBuffer {
  const bytes = new TextEncoder().encode("hello review");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

test("write validation accepts Files canonical Workspace path after attachment transfer", async () => {
  const port = new NeutronFilesPort(async (call, attachments) => {
    expect(call.name).toBe("writeBinary");
    const attachment = attachments[0];
    expect(attachment).toBeDefined();
    expect(attachment!.byteLength).toBe(12);
    expect(attachment!.data.byteLength).toBe(12);

    structuredClone(attachment!.data, { transfer: [attachment!.data] });
    expect(attachment!.data.byteLength).toBe(0);

    return {
      value: {
        path: "/Workspace/e2e/review.md",
        mediaType: "text/markdown",
        byteLength: 12,
        etag: ETAG,
      },
      attachments: [],
    };
  });

  const data = reviewBytes();
  const metadata = await port.writeBinary(
    "/e2e/review.md",
    "text/markdown",
    data,
    { ifNoneMatch: "*" },
  );

  expect(metadata.path).toBe("/Workspace/e2e/review.md");
  expect(metadata.byteLength).toBe(12);
  expect(metadata.etag).toBe(ETAG);
  expect(data.byteLength).toBe(12);
});

test("read validation accepts Files canonical Workspace path for an unrooted app path", async () => {
  const port = new NeutronFilesPort(async (call, attachments) => {
    expect(call.name).toBe("readBinary");
    expect(attachments).toHaveLength(0);
    const data = reviewBytes();
    return {
      value: {
        path: "/Workspace/e2e/review.md",
        mediaType: "text/markdown",
        byteLength: 12,
        etag: ETAG,
      },
      attachments: [{
        name: "file",
        mediaType: "text/markdown",
        byteLength: 12,
        data,
      }],
    };
  });

  const result = await port.readBinary("/e2e/review.md");
  expect(result.path).toBe("/Workspace/e2e/review.md");
  expect(result.byteLength).toBe(12);
  expect(result.etag).toBe(ETAG);
  expect(new TextDecoder().decode(result.data)).toBe("hello review");
});
