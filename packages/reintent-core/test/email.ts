// A second host with nothing to do with layout: a reply an assistant drafts for an email. Its
// own context (how long until the deadline), its own components, its own host nodes.
import {
  childrenOf,
  createContext,
  h,
  host,
  isUnresolved,
  UNKNOWN,
  useCtx,
  useChoice,
  useKey,
  type Child,
} from '../src/core/index';

export type Thread = { id: string; hoursLeft: number };
export const ThreadCtx = createContext<Thread>('Thread', { axes: { hoursLeft: (t) => t.hoursLeft } });

const value = <T,>(v: unknown, otherwise: T): T =>
  v === UNKNOWN ? otherwise : isUnresolved<T>(v) ? (v.fallback ?? otherwise) : (v as T);

export function Reply(p: { children?: Child }) {
  const tone = useChoice<'formal' | 'warm'>('tone', {
    default: 'warm',
    ask: true,
    kinds: ['formal', 'warm'],
  });
  const t = value<'formal' | 'warm'>(tone, 'warm');
  const sendAt = useChoice<'now' | 'tomorrow'>('send', { default: 'tomorrow', kinds: ['now', 'tomorrow'] });
  return host('reply', {
    id: useKey(),
    tone: t,
    send: value<'now' | 'tomorrow'>(sendAt, 'tomorrow'),
    // Length is an intent only of a formal reply: a guard is just a branch.
    children: t === 'formal' ? [h(Length, null), ...childrenOf(p.children)] : childrenOf(p.children),
  });
}
function Length() {
  useCtx(ThreadCtx);
  const len = useChoice<'short' | 'long'>('length', { default: 'short', kinds: ['short', 'long'] });
  return host('length', { value: value<'short' | 'long'>(len, 'short') });
}
