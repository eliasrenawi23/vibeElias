/**
 * Pretend a desktop viewport (every `min-width` breakpoint matches, so `DataTable` renders a
 * table) or a phone (none matches: card lists). Returns the function that restores jsdom's own.
 */
export function mockViewport(kind: 'desktop' | 'phone'): () => void {
  const original = window.matchMedia;
  window.matchMedia = (query: string) =>
    ({
      matches: kind === 'desktop' && query.includes('min-width'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  return () => {
    window.matchMedia = original;
  };
}
