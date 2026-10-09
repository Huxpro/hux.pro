// =============================================================================
// Is this a question or a search? The palette asks it of every query, to
// decide where Ask sits in the results: first (and what ↵ does) for a
// question, last for a search, where it is still a Tab or an arrow away.
//
// Cheap signals only, read on every keystroke: a question mark, a question
// word up front, or simply length. Nobody types eight words to find a page.
// =============================================================================

const QUESTION_EN =
  /^(?:what|why|how|who|whom|whose|when|where|which|is|are|was|were|do|does|did|can|could|should|would|will|has|have|tell me|explain|compare|summari[sz]e|describe)\b/i;

const QUESTION_ZH =
  /(?:^(?:为什么|为何|怎么|怎样|如何|什么|哪|谁|是否|能否|能不能|可不可以|有没有|请问|介绍|解释|总结|比较)|什么|怎么|如何|为什么|吗|呢|么)[\s?？]*$|^(?:为什么|为何|怎么|怎样|如何|什么|哪|谁|是否|能否|能不能|请问|介绍|解释|总结|比较)/;

const HAN = /\p{Script=Han}/gu;

export function isQuestionLike(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (/[?？]$/.test(q)) return true;
  if (QUESTION_EN.test(q) && q.includes(" ")) return true;
  if (QUESTION_ZH.test(q)) return true;
  const han = q.match(HAN)?.length ?? 0;
  if (han >= 10) return true;
  const words = q.split(/\s+/).filter(Boolean).length;
  return words >= 5;
}
