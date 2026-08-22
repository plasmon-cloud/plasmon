export type SerializedRefreshPass = () => Promise<void>;

/**
 * Serializes refresh requests without losing one that arrives while the active
 * runner is settling. Requests that arrive during a pass are coalesced into a
 * single follow-up pass, and every caller waits until the queue is idle.
 */
export class SerializedRefreshQueue {
  private requested = 0;
  private completed = 0;
  private running: Promise<void> | null = null;
  private latestPass: SerializedRefreshPass | null = null;

  async request(pass: SerializedRefreshPass): Promise<void> {
    this.latestPass = pass;
    this.requested += 1;

    while (this.completed < this.requested) {
      await (this.running ?? this.start());
    }
  }

  private start(): Promise<void> {
    const operation = this.run();
    this.running = operation;

    const clear = () => {
      if (this.running === operation) this.running = null;
    };
    void operation.then(clear, clear);

    return operation;
  }

  private async run(): Promise<void> {
    while (this.completed < this.requested) {
      const throughRequest = this.requested;
      const pass = this.latestPass;
      if (!pass) return;

      try {
        await pass();
      } finally {
        // Complete only the requests observed before this pass began. A
        // request made while the pass is in flight remains pending and forces
        // another serialized read.
        this.completed = Math.max(this.completed, throughRequest);
      }
    }
  }
}
