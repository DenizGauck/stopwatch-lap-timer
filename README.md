# stopwatch-lap-timer

A small ESM stopwatch that records lap splits and cumulative elapsed time. The clock is injectable so tests stay deterministic.

```js
import { Stopwatch } from 'stopwatch-lap-timer';

const sw = new Stopwatch();          // uses performance.now, falls back to Date.now
sw.start();
// ... some time passes ...
const lap1 = sw.split();             // { split, total, at }
const lap2 = sw.split();
const total = sw.stop();             // total elapsed ms
sw.reset();                          // back to zero, laps cleared
```

Exports: `Stopwatch` (named) from `src/index.js`.

`Stopwatch` API:
- `new Stopwatch(clock?)` — `clock` is `() => number` returning monotonic ms. Defaults to `performance.now` (or `Date.now` if `performance` is absent).
- `start()` → number. Begins or resumes accumulation. Idempotent; returns the elapsed time accumulated *before* this run.
- `stop()` → number. Freezes accumulation. Idempotent; returns the new total elapsed.
- `split()` → `{ split, total, at }`. `split` is ms since the previous split (or since the resume point if this is the first split after a stop/start); `total` is cumulative elapsed; `at` is the raw clock reading. Throws if the watch is stopped.
- `reset()` — stops the watch, zeroes elapsed, clears `laps`.
- `running` (getter) — boolean.
- `elapsed` (getter) — total ms accumulated so far.
- `laps` (array) — every split object, in order.

## Why this exists

Timing code that calls `Date.now()` inline is untestable: any test that asserts on elapsed time either sleeps (flaky) or fakes the clock ad hoc (duplicated everywhere). This library takes the clock as a constructor argument so tests advance time in fixed increments and never touch the wall clock. The trade-off is that callers who want real timing must accept the default clock or pass their own.

## The awkward edge

`split()`'s baseline is the *previous split's total*, or — for the first split after a `stop`/`start` — the elapsed time accumulated *before* the current run. So if you run 100ms, stop, resume, then split after 20ms, that first split reads `20`, not `120`. This keeps each split meaningful as "time in this running interval" but means splits do not span stop/start boundaries. If you need continuous splits across stops, don't stop the watch.

`start()` returns the elapsed time accumulated before the current run (not the live elapsed), and `stop()` returns the new total. These are the values the state machine actually transitions through; callers who need the live reading should use the `elapsed` getter.
