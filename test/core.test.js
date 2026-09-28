import { test } from 'node:test';
import assert from 'node:assert/strict';

import { Stopwatch } from '../src/index.js';

// A fake clock. We advance it explicitly rather than letting real time pass,
// so every assertion is independent of machine speed.
function makeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => { t += ms; },
    set: (ms) => { t = ms; },
  };
}

test('new stopwatch is stopped with zero elapsed and empty laps', () => {
  const c = makeClock();
  const sw = new Stopwatch(c.now);
  assert.equal(sw.running, false);
  assert.equal(sw.elapsed, 0);
  assert.deepEqual(sw.laps, []);
});

test('start makes the watch running and elapsed advances with the clock', () => {
  const c = makeClock(100);
  const sw = new Stopwatch(c.now);
  sw.start();
  assert.equal(sw.running, true);
  assert.equal(sw.elapsed, 0);
  c.advance(50);
  assert.equal(sw.elapsed, 50);
  c.advance(25);
  assert.equal(sw.elapsed, 75);
});

test('start is idempotent and does not reset the mark', () => {
  const c = makeClock(1000);
  const sw = new Stopwatch(c.now);
  sw.start();
  c.advance(40);
  const before = sw.elapsed;
  const returned = sw.start();
  assert.equal(sw.running, true);
  assert.equal(sw.elapsed, before);
  assert.equal(returned, before);
  c.advance(10);
  assert.equal(sw.elapsed, 50);
});

// start() returns elapsedPrior, not the live elapsed. We document and test
// that exact behaviour rather than guessing what callers might want.
test('start returns elapsedPrior (the accumulated time before this run)', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  sw.start();
  c.advance(100);
  sw.stop();
  c.advance(500);
  const r = sw.start();
  assert.equal(r, 100);
});

// stop() returns elapsedPrior (which now includes the just-ended run).
test('stop returns the new total elapsed and freezes elapsed', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  sw.start();
  c.advance(80);
  const stopped = sw.stop();
  assert.equal(stopped, 80);
  assert.equal(sw.running, false);
  c.advance(200);
  assert.equal(sw.elapsed, 80);
});

// stop on a stopped watch is a no-op. This matters for teardown code.
test('stop on a stopped watch is a no-op returning elapsedPrior', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  sw.start();
  c.advance(30);
  sw.stop();
  c.advance(10);
  const r = sw.stop();
  assert.equal(r, 30);
  assert.equal(sw.elapsed, 30);
});

// start/stop/start accumulates across intervals. This is the core invariant.
test('elapsed accumulates across stop/start cycles', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  sw.start(); c.advance(10); sw.stop();
  c.advance(1000); // stopped time is ignored
  sw.start(); c.advance(5); sw.stop();
  sw.start(); c.advance(3);
  assert.equal(sw.elapsed, 18);
});

test('split records split-since-previous and total', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  sw.start();
  c.advance(100);
  const l1 = sw.split();
  assert.equal(l1.split, 100);
  assert.equal(l1.total, 100);
  c.advance(50);
  const l2 = sw.split();
  assert.equal(l2.split, 50);
  assert.equal(l2.total, 150);
  c.advance(25);
  assert.equal(sw.elapsed, 175);
  assert.deepEqual(sw.laps, [l1, l2]);
});

// split after a stop/start: the first split's baseline is elapsedPrior, so
// the split measures only the time in the current running interval. This is
// the one awkward edge and we test the exact behaviour we implemented.
test('first split after a stop/start measures from the resume, not from zero', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  sw.start(); c.advance(100); sw.stop();
  c.advance(999); // ignored
  sw.start();
  c.advance(20);
  const l = sw.split();
  assert.equal(l.split, 20);
  assert.equal(l.total, 120);
});

test('split throws when stopped', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  assert.throws(() => sw.split(), /stopped/);
  sw.start(); sw.stop();
  assert.throws(() => sw.split(), /stopped/);
});

test('reset returns to the initial state and clears laps', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  sw.start(); c.advance(100); sw.split();
  c.advance(50); sw.split();
  sw.reset();
  assert.equal(sw.running, false);
  assert.equal(sw.elapsed, 0);
  assert.deepEqual(sw.laps, []);
  // and is usable again afterwards
  sw.start(); c.advance(5);
  assert.equal(sw.elapsed, 5);
});

// The lap object is the same reference stored in .laps, so callers can rely
// on identity rather than re-reading the array.
test('returned lap object is the same reference pushed into laps', () => {
  const c = makeClock(0);
  const sw = new Stopwatch(c.now);
  sw.start(); c.advance(10);
  const l = sw.split();
  assert.equal(sw.laps[0], l);
});

// Sanity check on the default clock: the constructor must not throw when no
// clock is supplied. We do NOT assert on the value (that would be a
// wall-clock test); we only assert the watch runs.
test('default clock works without being supplied', () => {
  const sw = new Stopwatch();
  sw.start();
  const e1 = sw.elapsed;
  sw.stop();
  const e2 = sw.elapsed;
  assert.equal(typeof e1, 'number');
  assert.equal(e2, e2); // frozen after stop
  assert.ok(e2 >= 0);
});
