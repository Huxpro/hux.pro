import assert from 'node:assert/strict';
import { test } from 'node:test';
import { askTools } from '../../systems/ask/lib/tools.ts';
import { recordCommandExecution } from '../../systems/ask/lib/command-state.ts';
import { COMMAND_IDS, commandIdOf } from '../../systems/command/catalog.ts';
import { commandsToPresent } from '../../systems/ask/lib/command-tools.ts';
import { scoreToolSelection } from '../lib/ask-tool-eval.mjs';
import { standInCommand } from '../../systems/ask/lib/stand-in-command.ts';
import { executeAskCommand, commandOfferReason } from '../../systems/ask/lib/execute-command.ts';

const messages = (part) => [{ id: 'reply', role: 'assistant', parts: [part] }];
const offer = { type: 'tool-command_language', toolCallId: 'lang', state: 'output-available', input: { value: 'zh' }, output: { offered: 'language', value: 'zh' } };

test('commands declare constrained targets and policy, without executing on the server', async () => {
  for (const id of COMMAND_IDS) {
    const t = askTools[`command_${id}`];
    assert.ok(t.description);
    assert.equal(t.execute, undefined, 'browser actions must not execute on the server');
  }
  assert.equal(askTools.list_commands.execute, undefined);
  assert.deepEqual((await askTools.command_theme.inputSchema.jsonSchema).properties.value.enum, ['light', 'dark', 'system', 'sun']);
  assert.deepEqual((await askTools.command_language.inputSchema.jsonSchema).properties.value.enum, ['en', 'zh']);
  assert.equal(commandIdOf('command___proto__'), null);
  assert.equal(commandIdOf('command_not-a-command'), null);
  assert.deepEqual((await askTools.command_voice.inputSchema.jsonSchema).properties.execution.enum, ['offer']);
  assert.deepEqual((await askTools.command_theme.inputSchema.jsonSchema).properties.execution.enum, ['offer', 'apply']);
});

test('successful taps persist without mutating the offer or adding a user/model turn', () => {
  const original = messages(offer);
  const next = recordCommandExecution(original, 'lang', 'language', 'zh');
  assert.equal(next.length, 1);
  assert.deepEqual(next[0].parts[0].output.executed, { value: 'zh' });
  assert.equal(original[0].parts[0].output.executed, undefined);
  assert.equal(next[0].parts[0].toolCallId, 'lang');
});

test('wrong call ids, mismatched commands, invalid values and failed offers cannot be marked as executed', () => {
  const original = messages(offer);
  for (const [callId, id, value] of [['unknown', 'language', 'zh'], ['lang', 'theme', 'dark'], ['lang', 'language', 'fr']]) {
    assert.deepEqual(recordCommandExecution(original, callId, id, value), original);
  }
  const failed = messages({ ...offer, output: { error: 'Unavailable' } });
  assert.deepEqual(recordCommandExecution(failed, 'lang', 'language', 'zh'), failed);
});

test('discovery menu records independent actions and can update a setting again', () => {
  const menu = messages({ type: 'tool-list_commands', toolCallId: 'menu', state: 'output-available', input: {}, output: { commands: ['theme', 'language'] } });
  const first = recordCommandExecution(menu, 'menu', 'theme', 'dark');
  const second = recordCommandExecution(first, 'menu', 'language', 'zh');
  const third = recordCommandExecution(second, 'menu', 'theme', 'light');
  assert.deepEqual(third[0].parts[0].output.executed, { theme: { value: 'light' }, language: { value: 'zh' } });
  assert.deepEqual(recordCommandExecution(third, 'menu', 'sky-window'), third);
});

test('keyless demo exercises explicit requests/discovery but leaves ordinary content alone', () => {
  assert.deepEqual(standInCommand('Switch this site to Chinese'), { toolName: 'command_language', input: { value: 'zh', execution: 'apply' } });
  assert.deepEqual(standInCommand('把主题改成浅色'), { toolName: 'command_theme', input: { value: 'light', execution: 'apply' } });
  assert.deepEqual(standInCommand('你能帮我做什么？'), { toolName: 'list_commands', input: { ids: ['theme', 'sky-window'] } });
  assert.equal(standInCommand('为什么月亮有阴晴圆缺？'), null);
  assert.deepEqual(standInCommand('How do I switch to Chinese?'), { toolName: 'command_language', input: { value: 'zh', execution: 'offer' } });
  assert.deepEqual(standInCommand('Can you switch this site to Chinese?'), { toolName: 'command_language', input: { value: 'zh', execution: 'apply' } });
});

test('policy requires clicks for voice/GPS/start music, but allows pause, IP and opening explanations', () => {
  for (const [id, value] of [['voice'], ['debug-panel'], ['location', 'gps'], ['music', 'play']]) {
    assert.equal(commandOfferReason(id, { execution: 'apply', value }, true), 'user-gesture');
  }
  for (const [id, value] of [['theme', 'dark'], ['language', 'zh'], ['music', 'pause'], ['location', 'ip'], ['wallpaper', 'picker'], ['sky-window'], ['install'], ['writing']]) {
    assert.equal(commandOfferReason(id, { execution: 'apply', value }, true), null);
  }
  assert.equal(commandOfferReason('theme', { execution: 'apply' }, true), 'choose-target');
  assert.equal(commandOfferReason('theme', { value: 'dark' }, true), 'suggestion');
  assert.equal(commandOfferReason('theme', { execution: 'apply', value: 'dark' }, false), 'background');
});

test('execution applies exact targets, offers guarded actions, and never reports a failed action as done', async () => {
  const runs = [];
  const host = { commands: COMMAND_IDS.map((id) => ({ id })), visible: true, runCommand: async (...args) => { runs.push(args); } };
  assert.deepEqual(await executeAskCommand('theme', { execution: 'apply', value: 'dark' }, host, true), { offered: 'theme', value: 'dark', executed: { value: 'dark' } });
  for (const [id, input, foreground] of [['language', { value: 'zh' }, true], ['theme', { execution: 'apply' }, true], ['music', { execution: 'apply', value: 'play' }, true], ['theme', { execution: 'apply', value: 'light' }, false]]) {
    assert.ok((await executeAskCommand(id, input, host, foreground)).reason);
  }
  assert.equal((await executeAskCommand('language', { execution: 'apply', value: 'zh' }, { ...host, visible: false }, true)).reason, 'background');
  for (const restrictedHost of [null, { ...host, commands: [] }]) {
    assert.ok((await executeAskCommand('language', { execution: 'apply', value: 'zh' }, restrictedHost, true)).error);
  }
  assert.ok((await executeAskCommand('language', { execution: 'apply', value: 'fr' }, host, true)).error);
  assert.deepEqual(runs, [['theme', 'dark']]);
  const failure = await executeAskCommand('theme', { execution: 'apply', value: 'light' }, { ...host, runCommand: async () => { throw new Error('failed'); } }, true);
  assert.ok(failure.error);
  assert.equal(failure.executed, undefined);
});

test('selected presentation respects 1–2 ids, order and availability, without expanding to the catalog', () => {
  assert.deepEqual(commandsToPresent(COMMAND_IDS, { ids: ['sky-window', 'theme'] }), ['sky-window', 'theme']);
  assert.deepEqual(commandsToPresent(['language'], { ids: ['theme', 'language', 'language'] }), ['language']);
  assert.deepEqual(commandsToPresent(COMMAND_IDS, {}), []);
  assert.deepEqual(standInCommand('Show me all commands'), { toolName: 'list_commands', input: { ids: COMMAND_IDS } });
});

test('benchmark rejects a menu dump for discovery and checks both requested targets', () => {
  assert.equal(scoreToolSelection({ mode: 'discovery' }, [{ tool: 'list_commands', input: { ids: COMMAND_IDS } }]).correct, false);
  assert.deepEqual(scoreToolSelection({ mode: 'discovery' }, [{ tool: 'list_commands', input: { ids: ['theme', 'sky-window'] } }]), { correct: true, shownActions: 2 });
  assert.equal(scoreToolSelection({ mode: 'discovery' }, [{ tool: 'list_commands', input: { ids: ['theme', 'theme'] } }]).correct, false);
  assert.equal(scoreToolSelection({ mode: 'all-commands' }, [{ tool: 'list_commands', input: { ids: COMMAND_IDS } }]).correct, true);
  const test = { calls: [{ tool: 'command_theme', value: 'dark' }, { tool: 'command_language', value: 'en' }] };
  const calls = [{ tool: 'command_language', input: { value: 'en' } }, { tool: 'command_theme', input: { value: 'dark' } }];
  assert.deepEqual(scoreToolSelection(test, calls), { correct: true, shownActions: 2 });
  assert.equal(scoreToolSelection(test, calls.slice(0, 1)).correct, false);
  assert.equal(scoreToolSelection(test, [...calls, { tool: 'list_commands', input: { ids: COMMAND_IDS } }]).correct, false);
  const specific = { tool: 'command_theme', value: 'dark', outcome: 'apply' };
  assert.equal(scoreToolSelection(specific, [{ tool: 'command_theme', input: { value: 'dark' } }]).correct, false);
  assert.equal(scoreToolSelection(specific, [{ tool: 'command_theme', input: { value: 'dark', execution: 'apply' } }]).correct, true);
  assert.equal(scoreToolSelection({ ...specific, outcome: 'offer' }, [{ tool: 'command_theme', input: { value: 'dark', execution: 'apply' } }]).correct, false);
  assert.equal(scoreToolSelection({ tool: 'command_music', value: 'play', outcome: 'offer' }, [{ tool: 'command_music', input: { value: 'play', execution: 'apply' } }]).correct, true);
});
