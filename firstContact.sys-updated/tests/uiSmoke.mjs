import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { default: App } = await server.ssrLoadModule('/src/App.tsx');
  const html = renderToStaticMarkup(createElement(App));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /Find your window/);
  assert.match(html, /Pause Moon rotation/);
  assert.match(html, /id="journey"/);
  assert.match(html, /id="method"/);
  assert.match(html, /original first contact artwork/i);
  assert.doesNotMatch(html, /Mission Repair Solver/);
  const { default: Workspace } = await server.ssrLoadModule('/src/Workspace.tsx');
  const workspace = renderToStaticMarkup(createElement(Workspace));
  assert.match(workspace, /Your lunar window/);
  assert.match(workspace, /aria-label="Mission hour"/);
  assert.match(workspace, /Landscape/);
  assert.match(workspace, /Time &amp; location/);
  assert.match(workspace, /Assumptions/);
  assert.doesNotMatch(workspace, /CLPS Spacecraft Profiles &amp; Hardware Envelope/);
  assert.match(workspace, /not independently validated/);
  console.log('PASS: landing and default workspace render; navigation targets, motion control, initial panel and model limits present. Browser interaction not tested.');
} finally { await server.close(); }
