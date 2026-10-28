// First-call selection benchmark. No execute functions, browser effects or
// synthetic tools. --run uses real Gateway credentials; the default is offline.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateText, gateway } from 'ai';
import { askTools } from '../systems/ask/lib/tools.ts';
import { COMMAND_IDS, commandDefinition, commandIdOf } from '../systems/command/catalog.ts';
import { ASK_MODELS, DEFAULT_ASK_MODEL } from '../systems/ask/lib/models.ts';
import { scoreToolSelection } from './lib/ask-tool-eval.mjs';
import { tokenize } from '../systems/ask/lib/tokenize.ts';

// Next accepts JSON imports without attributes; plain Node needs a loader.
const root = pathToFileURL(process.cwd() + '/').href;
registerHooks({ load(url, context, nextLoad) {
  if (url.startsWith(root) && url.endsWith('.json')) {
    return { format: 'module', shortCircuit: true, source: `export default ${readFileSync(new URL(url), 'utf8')}` };
  }
  return nextLoad(url, context);
} });
const { askSystemPrompt } = await import('../lib/ask-prompt.ts');

const cases = [
  ['dark-en', 'Switch the site to dark mode', 'command_theme', 'dark'],
  ['light-zh', '帮我把主题改成浅色', 'command_theme', 'light'],
  ['sun-zh', '外观跟随太阳，日落就变暗', 'command_theme', 'sun'],
  ['system-en', 'Set the theme to follow my operating system', 'command_theme', 'system'],
  ['theme-choice', '我想更改主题', 'command_theme'],
  ['language-zh', '把网站语言改成英文', 'command_language', 'en'],
  ['language-en', 'Switch this website to Chinese', 'command_language', 'zh'],
  ['wallpaper', '帮我换一张壁纸', 'command_wallpaper'],
  ['weather-zh', '把天气壁纸改成渐变', 'command_wallpaper', 'gradient'],
  ['sky-style', 'Use the animated sky as my background', 'command_wallpaper', 'sky'],
  ['sky-window', 'Open Sky Window', 'command_sky-window'],
  ['sky-indirect', '我能转动手机看网站里的太阳和月亮吗？', 'command_sky-window'],
  ['location', 'Use accurate GPS for my local weather', 'command_location', 'gps'],
  ['glass', 'Make the glass clear', 'command_glass', 'clear'],
  ['tint', '让玻璃跟随壁纸着色', 'command_tint', 'wallpaper'],
  ['music', 'Pause the background music', 'command_music', 'pause'],
  ['install', 'How do I add this site to my home screen?', 'command_install'],
  ['about', 'Show me the About overlay', 'command_about'],
  ['lab', '打开实验室看看交互怎么实现的', 'command_lab'],
  ['docs', 'Open the site documentation', 'command_docs'],
  ['voice', 'Start voice dictation', 'command_voice'],
  ['devtool', '打开调试面板', 'command_debug-panel'],
  ['discover-en', 'What can you help me do on this site?', 'list_commands'],
  ['discover-zh', '你能帮我做什么？', 'list_commands'],
  ['hello', 'Hi!', null],
  ['small-talk', '谢谢你', null],
  ['content', 'What is Lynx and why did you build it?', 'search_site'],
  ['moon-content', '为什么月亮有阴晴圆缺？', 'search_site'],
].map(([id, prompt, tool, value]) => ({ id, prompt, tool, value,
  ...(commandIdOf(tool ?? '') ? { outcome: ['theme-choice', 'wallpaper', 'sky-indirect', 'location', 'install', 'voice', 'devtool'].includes(id) ? 'offer' : 'apply' } : {}),
  ...(id.startsWith('discover-') ? { mode: 'discovery' } : {}),
}));
cases.push(
  { id: 'dual-zh', prompt: '把主题改成深色，再把网站语言切成英文', calls: [{ tool: 'command_theme', value: 'dark', outcome: 'apply' }, { tool: 'command_language', value: 'en', outcome: 'apply' }] },
  { id: 'dual-en', prompt: 'Switch to Chinese and pause the background music', calls: [{ tool: 'command_language', value: 'zh', outcome: 'apply' }, { tool: 'command_music', value: 'pause', outcome: 'apply' }] },
  { id: 'all-commands', prompt: 'Show me the complete list of every command on this site', tool: 'list_commands', mode: 'all-commands' },
  { id: 'theme-offer', prompt: 'Show me the dark-mode action without changing my theme', tool: 'command_theme', value: 'dark', outcome: 'offer' },
  { id: 'language-how', prompt: 'How do I switch the site to Chinese?', tool: 'command_language', value: 'zh', outcome: 'offer' },
  { id: 'start-music', prompt: 'Play the background music', tool: 'command_music', value: 'play', outcome: 'offer' },
);

const args = process.argv.slice(2);
const flag = (name, fallback) => args.find((arg) => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=') ?? fallback;
const run = args.includes('--run');
const modelsArg = flag('models', DEFAULT_ASK_MODEL);
const models = modelsArg === 'all' ? ASK_MODELS.map((m) => m.id) : modelsArg.split(',');
if (models.some((id) => !ASK_MODELS.some((m) => m.id === id))) throw new Error('Use a model from systems/ask/lib/models.ts or --models=all.');
const repeats = Number(flag('repeats', '1'));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error('--repeats must be an integer from 1 to 20.');
const selectedCases = flag('cases', '') ? cases.filter((c) => flag('cases', '').split(',').includes(c.id)) : cases;
if (!selectedCases.length) throw new Error('No cases selected.');
if (run && !process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) {
  throw new Error('Live benchmark requires AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN. Default mode measures schemas and shortlist recall offline.');
}

// Experimental lexical pruning, deliberately separate from production. The
// expected answer never participates in selecting tools. Poor recall is a
// result, not something hidden by forcing the expected command into the set.
const core = Object.keys(askTools).filter((name) => !commandIdOf(name));
const stops = new Set(tokenize('the a an to for my me this it is do can you what how I please help site website open change set switch use 帮 我 你 网站 这个 把 更改 切换 设置 打开 选择 能 的 了').map((t) => t.toLowerCase()));
function shortlist(prompt, count) {
  const terms = [...new Set(tokenize(prompt).map((t) => t.toLowerCase()).filter((t) => !stops.has(t)))];
  const ranked = COMMAND_IDS.map((id) => {
    const d = commandDefinition(id);
    const titles = [id, d.title.en, d.title.zh, ...(d.options ?? []).flatMap((o) => [o.value, o.en, o.zh])].join(' ').toLowerCase();
    const descriptions = d.description.toLowerCase();
    const score = terms.reduce((n, term) => n + (titles.includes(term) ? 5 : descriptions.includes(term) ? 1 : 0), 0);
    return { name: `command_${id}`, score };
  }).sort((a, b) => b.score - a.score);
  return [...core, ...ranked.slice(0, Math.max(0, count - core.length)).map((c) => c.name)];
}
const variants = [12, 18, Object.keys(askTools).length];
const schemas = Object.fromEntries(await Promise.all(Object.entries(askTools).map(async ([name, t]) => [name, { name, description: t.description, parameters: await t.inputSchema.jsonSchema }])));
const rows = [];
for (let repetition = 0; repetition < (run ? repeats : 1); repetition++) {
  for (const test of selectedCases) {
    // Rotate variant order to reduce warm-cache / order effects.
    for (let i = 0; i < variants.length; i++) {
      const count = variants[(i + repetition) % variants.length];
      const names = count === Object.keys(askTools).length ? Object.keys(askTools) : shortlist(test.prompt, count);
      const expected = test.calls?.map((c) => c.tool) ?? (test.tool ? [test.tool] : []);
      const row = { case: test.id, count, repetition, expected, expectedAvailable: expected.every((tool) => names.includes(tool)), schemaBytes: Buffer.byteLength(JSON.stringify(names.map((n) => schemas[n]))) };
      if (!run) { rows.push(row); continue; }
      for (const model of models) {
        const started = performance.now();
        try {
          const result = await generateText({ model: gateway(model), instructions: askSystemPrompt(), prompt: test.prompt,
            tools: askTools, activeTools: names, toolChoice: 'auto', reasoning: 'low', maxOutputTokens: 4000, maxRetries: 0, abortSignal: AbortSignal.timeout(45000) });
          const calls = result.toolCalls.map((c) => ({ tool: c.toolName, input: c.input }));
          const { correct, shownActions } = scoreToolSelection(test, calls);
          rows.push({ ...row, model, latencyMs: Math.round(performance.now() - started), correct, shownActions, calls, usage: result.usage, reply: result.text, finishReason: result.finishReason });
        } catch (error) {
          rows.push({ ...row, model, latencyMs: Math.round(performance.now() - started), correct: false, error: error.message });
        }
        console.log(`${model} ${count} tools ${test.id}: ${rows.at(-1).correct ? 'pass' : 'FAIL'}`);
      }
    }
  }
}
const meanUsage = (rows, key) => {
  const values = rows.map((r) => r.usage?.[key]).filter((v) => typeof v === 'number');
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
};
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = variants.flatMap((count) => (run ? models : ['offline']).map((model) => {
  const group = rows.filter((r) => r.count === count && (!run || r.model === model));
  return { model, tools: count, trials: group.length, selectionRecall: group.filter((r) => r.expectedAvailable).length / group.length,
    meanSchemaBytes: Math.round(group.reduce((n, r) => n + r.schemaBytes, 0) / group.length),
    ...(run ? { accuracy: group.filter((r) => r.correct).length / group.length, failures: group.filter((r) => r.error).length,
      meanShownActions: Math.round(group.filter((r) => typeof r.shownActions === 'number').reduce((n, r) => n + r.shownActions, 0) / Math.max(1, group.filter((r) => typeof r.shownActions === 'number').length) * 100) / 100,
      medianLatencyMs: median(group.map((r) => r.latencyMs)), meanInputTokens: meanUsage(group, 'inputTokens'),
      meanOutputTokens: meanUsage(group, 'outputTokens') } : {}) };
}));
const output = flag('output', `shots/ask-tools-${run ? 'live' : 'offline'}.json`);
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify({ mode: run ? 'live-first-call' : 'offline-schema-and-recall', time: new Date().toISOString(), systemPromptBytes: Buffer.byteLength(askSystemPrompt()), summary, rows }, null, 2) + '\n');
console.table(summary);
console.log(`Saved ${output}. Offline recall is tool availability, NOT model accuracy. Live trials measure the first call, not final-answer quality or browser execution.`);
