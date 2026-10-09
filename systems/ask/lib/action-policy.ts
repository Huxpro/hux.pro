/** Conservative, bilingual gate for side effects; ordinary questions get links/cards. */
export function requestedAction(text: string, action: 'open_page' | 'play'): boolean {
  const request = text.replace(/```[\s\S]*?```|`[^`]*`|"[^"\n]*"|“[^”]*”|「[^」]*」/g, ' ').trim();
  if (/\b(?:don['’]?t|do not|never|without)\b|不要|别|无需|不用/.test(request.toLowerCase())) return false;
  const prefix = /^(?:(?:please|can you|could you|would you|will you)\s+)*(?:please\s+)?/i;
  const command = request.replace(prefix, '').replace(/^(?:请你?|帮我|能否|可以|麻烦你?)+/, '').trim();
  return action === 'open_page'
    ? /^(?:open\b|go to\b|take me (?:to|there)\b|show me where\b|打开|跳转到|带我去|定位到)/i.test(command)
    : /^(?:play\b|watch\b|start (?:the |this )?(?:video|talk|recording)\b|播放|放一下)/i.test(command);
}

/** URL parsing catches backslashes and other spellings that escape a path prefix check. */
export function siteActionHref(href: string, origin: string): string | null {
  if (!href.startsWith('/') || href.startsWith('//')) return null;
  try {
    const url = new URL(href, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch { return null; }
}
