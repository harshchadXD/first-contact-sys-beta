/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { initializeEngine } from "./engineLoader.ts";

test("reports an unavailable WASM build instead of returning a fallback", async () => {
  await assert.rejects(initializeEngine(), /WASM build is not available/);
});

test("awaits initialization and verifies the JSON export", async () => {
  let initialized = false;
  const analyze = await initializeEngine(async () => ({
    default: async () => {
      initialized = true;
    },
    analyze_json: (request: string) => {
      assert.ok(initialized);
      return request;
    },
  }));
  assert.equal(analyze("request"), "request");
});

test("rejects incompatible modules and initialization failures", async () => {
  for (const module of [
    null,
    {},
    { default: () => {} },
    { default: () => {}, analyze_json: 3 },
  ]) {
    await assert.rejects(
      initializeEngine(async () => module),
      /incompatible/i,
    );
  }
  await assert.rejects(
    initializeEngine(async () => ({
      default: async () => {
        throw new Error("WASM fetch failed");
      },
      analyze_json: () => "",
    })),
    /WASM fetch failed/,
  );
});

test("rejects non-string results from the JSON export", async () => {
  const analyze = await initializeEngine(async () => ({
    default: async () => {},
    analyze_json: () => null,
  }));
  assert.throws(() => analyze("{}"), /JSON string/);
});
