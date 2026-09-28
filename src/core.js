/**
 * Stopwatch with lap-split and cumulative-elapsed tracking.
 *
 * The clock is injected so tests can be deterministic. We deliberately use a
 * numeric clock (milliseconds-as-number) rather than reaching for
 * `performance.now()` inside the library: that keeps the module pure in
 * environments where `performance` is absent and lets tests advance time in
 * fixed increments without sleeping.
 *
 * State machine: the stopwatch is in exactly one of "running" or "stopped".
 * `start` on a running watch is a no-op (not an error) because callers in a
 * UI loop tend to call start every frame and we don't want to throw on that.
 * `stop` on a stopped watch is likewise a no-op so teardown code can call it
 * unconditionally. `split` on a stopped watch is an error: a split with no
 * running interval is meaningless and silently returning a zero split would
 * hide bugs in the caller.
 */
export class Stopwatch {
  /**
   * @param {() => number} [clock] Returns monotonic milliseconds. Defaults to
   *   `performance.now.bind(performance)` when available, else `Date.now`.
   *   The fallback exists so the module loads in a bare Node REPL without
   *   `--experimental-perf`; it is not meant for real timing.
   */
  constructor(clock) {
    if (clock === undefined) {
      if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        clock = performance.now.bind(performance);
      } else {
        clock = Date.now;
      }
    }
    this._clock = clock;
    this._running = false;
    this._startMark = 0;
    this._elapsedPrior = 0;
    /** @type {{ split: number, total: number, at: number }[]} */
    this.laps = [];
  }

  /** True while the stopwatch is accumulating time. */
  get running() {
    return this._running;
  }

  /**
   * Total elapsed time in milliseconds since the first `start`, minus any
   * stopped intervals. Does not mutate state.
   */
  get elapsed() {
    if (!this._running) return this._elapsedPrior;
    return this._elapsedPrior + (this._clock() - this._startMark);
  }

  /**
   * Begin (or resume) accumulating time. Idempotent: calling start on a
   * running stopwatch returns the current elapsed without resetting the mark.
   *
   * @returns {number} Total elapsed milliseconds at the moment of start.
   */
  start() {
    if (this._running) return this.elapsed;
    this._startMark = this._clock();
    this._running = true;
    return this._elapsedPrior;
  }

  /**
   * Stop accumulating time. Idempotent.
   *
   * @returns {number} Total elapsed milliseconds at the moment of stop.
   */
  stop() {
    if (!this._running) return this._elapsedPrior;
    this._elapsedPrior += this._clock() - this._startMark;
    this._running = false;
    return this._elapsedPrior;
  }

  /**
   * Record a lap split.
   *
   * `split` is the time since the previous split (or since start if this is
   * the first). `total` is the cumulative elapsed at the split instant.
   *
   * @returns {{ split: number, total: number, at: number }}
   * @throws {Error} If the stopwatch is not running.
   */
  split() {
    if (!this._running) {
      throw new Error('Cannot split a stopped stopwatch');
    }
    const now = this._clock();
    const total = this._elapsedPrior + (now - this._startMark);
    const prevTotal = this.laps.length > 0 ? this.laps[this.laps.length - 1].total : this._elapsedPrior;
    const lap = { split: total - prevTotal, total, at: now };
    this.laps.push(lap);
    return lap;
  }

  /**
   * Return to the initial state: stopped, zero elapsed, no laps.
   *
   * @returns {void}
   */
  reset() {
    this._running = false;
    this._startMark = 0;
    this._elapsedPrior = 0;
    this.laps.length = 0;
  }
}
