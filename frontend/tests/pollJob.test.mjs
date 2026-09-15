import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/pollJob.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const { pollJob } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("slow requests do not overlap and completion stops polling", async (t) => {
  let resolveResponse;
  let nextPoll;
  const fetchMock = t.mock.method(globalThis, "fetch", () => new Promise((resolve) => {
    resolveResponse = resolve;
  }));
  const timer = t.mock.method(globalThis, "setTimeout", (callback) => { nextPoll = callback; return 1; });
  const statuses = [];
  const stop = pollJob("/job", (status) => statuses.push(status.state), assert.fail);
  t.after(stop);
  await flush();
  assert.equal(timer.mock.callCount(), 0);
  resolveResponse(Response.json({ state: "running" }));
  await flush();
  assert.equal(timer.mock.callCount(), 1);
  nextPoll();
  assert.equal(fetchMock.mock.callCount(), 2);
  resolveResponse(Response.json({ state: "completed" }));
  await flush();
  assert.deepEqual(statuses, ["running", "completed"]);
  assert.equal(timer.mock.callCount(), 1);
});

for (const failure of [404, 500, "network"]) {
  test(`failure ${failure} reports an error and stops`, async (t) => {
    t.mock.method(globalThis, "fetch", async () => {
      if (failure === "network") throw new TypeError("Failed to fetch");
      return new Response(null, { status: failure });
    });
    const timer = t.mock.method(globalThis, "setTimeout", () => assert.fail("unexpected retry"));
    const errors = [];
    const stop = pollJob("/job", assert.fail, (message) => errors.push(message));
    t.after(stop);
    await flush();
    assert.equal(errors.length, 1);
    assert.match(errors[0], /Go/);
    if (failure === 404) assert.match(errors[0], /見つかりません/);
    assert.equal(timer.mock.callCount(), 0);
  });
}

test("switching jobs ignores the old response even if it arrives after cancellation", async (t) => {
  let resolveBody;
  let signal;
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise((resolve) => { resolveBody = resolve; }) };
  });
  t.mock.method(globalThis, "setTimeout", () => assert.fail("unexpected retry"));
  const stop = pollJob("/old-job", assert.fail, assert.fail);
  await flush();
  stop();
  assert.equal(signal.aborted, true);
  resolveBody({ state: "running" });
  await flush();
});
