import assert from 'node:assert/strict';
import test from 'node:test';
import { executeWebMCPTool, registerWebMCPTools } from '../src/webmcp/registerTools.ts';
import { useGameStore } from '../src/store/useGameStore.ts';

test('WebMCP tools execute when the caller omits execution options or the signal', async () => {
  useGameStore.getState().reset();

  const withoutOptions = await executeWebMCPTool('get_country_state', {});
  const withoutSignal = await executeWebMCPTool('get_country_state', {}, {});

  assert.equal(withoutOptions.month, useGameStore.getState().country.month);
  assert.equal(withoutSignal.month, useGameStore.getState().country.month);
});

test('registered WebMCP callbacks tolerate the one-argument invocation shape', async () => {
  const previous = (globalThis as { document?: unknown }).document;
  let executeCountryState: ((input: unknown, options?: { signal?: AbortSignal }) => Promise<unknown>) | undefined;

  const fakeContext = {
    registerTool: async (tool: { name: string; execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<unknown> }) => {
      if (tool.name === 'get_country_state') executeCountryState = tool.execute;
    },
  };

  (globalThis as { document?: unknown }).document = { modelContext: fakeContext };
  const registration = await registerWebMCPTools();
  assert.equal(registration.registered, true);
  assert.ok(executeCountryState);

  useGameStore.getState().reset();
  const result = await executeCountryState({}) as { month: number };
  assert.equal(result.month, useGameStore.getState().country.month);

  registration.cleanup();
  delete (globalThis as { document?: unknown }).document;
  if (previous) (globalThis as { document?: unknown }).document = previous;
});

test('a real aborted execution signal is still honored', async () => {
  const controller = new AbortController();
  controller.abort(new Error('cancelled by test'));

  await assert.rejects(
    () => executeWebMCPTool('get_country_state', {}, { signal: controller.signal }),
    /cancelled by test/,
  );
});
