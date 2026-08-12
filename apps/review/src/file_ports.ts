export type BinaryFileMetadata = {
  path: string;
  mediaType: string;
  byteLength: number;
  etag: string;
  updatedAt?: number;
};

export type BinaryFileRead = BinaryFileMetadata & { data: ArrayBuffer };

export interface ReviewFilesPort {
  readBinary(path: string, options?: { ifMatch?: string; delegationToken?: string }): Promise<BinaryFileRead>;
  writeBinary(
    path: string,
    mediaType: string,
    data: ArrayBuffer,
    condition: { ifMatch: string } | { ifNoneMatch: "*" },
    options?: { delegationToken?: string },
  ): Promise<BinaryFileMetadata>;
}

export class FilePortError extends Error {
  constructor(readonly code: string, message: string, readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "FilePortError";
  }
}
