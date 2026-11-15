/// <reference types="node" />
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateStudyPayload } from "./studyLoader.ts";

const read = () =>
  JSON.parse(
    fs.readFileSync(
      new URL("../data/shackletonStudy.json", import.meta.url),
      "utf8",
    ),
  );
test("regional loader accepts the shipped measured study", () =>
  assert.doesNotThrow(() => validateStudyPayload(read())));
test("regional loader rejects missing supported-height data", () => {
  const value = read();
  delete value.heightProfiles["0:0"]["5.0"];
  assert.throws(() => validateStudyPayload(value), /supported-height/);
});
test("regional loader rejects terrain gaps rather than inventing a surface", () => {
  const value = read();
  value.terrain.elevationsMeters[0] = NaN;
  assert.throws(() => validateStudyPayload(value), /terrain mesh/);
});
test("regional loader rejects duplicate point identities", () => {
  const value = read();
  value.points[1].id = value.points[0].id;
  assert.throws(() => validateStudyPayload(value), /duplicate/);
});
test("regional loader rejects unsupported observer heights", () => {
  const value = read();
  value.supportedHeightsMeters = [0, 3];
  assert.throws(() => validateStudyPayload(value), /unsupported/);
});
test("regional loader rejects missing convergence evidence", () => {
  const value = read();
  delete value.sourceManifest.correctedGeographicBake.convergence;
  assert.throws(() => validateStudyPayload(value), /provenance/);
});
