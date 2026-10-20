/** The Mutabaa mark: an open ring closing on a check — "followed up and done". Drawn in currentColor. */
export function BrandGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.5 12a8.5 8.5 0 1 1-4.2-7.33" />
      <path d="M8 12.2l2.9 2.9L20 6" />
    </svg>
  );
}

export function BrandTile({ size = 38 }: { size?: number }) {
  return (
    <span className="ui-side__logo" style={{ width: size, height: size, borderRadius: Math.round(size * 0.29) }}>
      <BrandGlyph size={Math.round(size * 0.53)} />
    </span>
  );
}
