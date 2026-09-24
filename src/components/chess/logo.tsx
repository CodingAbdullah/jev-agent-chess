/** The Jev Chess king, drawn in the current text colour. Matches `src/app/icon.svg`. */
export function KingLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="8 3 48 54" fill="currentColor" aria-hidden="true" className={className}>
      <rect x="29.5" y="5" width="5" height="14" rx="1.5" />
      <rect x="25" y="8.5" width="14" height="5" rx="1.5" />
      <path d="M18 22c9-4 19-4 28 0l-4.5 9h-19z" />
      <rect x="21.5" y="32.5" width="21" height="4" rx="1.5" />
      <path d="M24.5 38h15c.5 3.5 2.5 6.5 4 8.5h-23c1.5-2 3.5-5 4-8.5z" />
      <rect x="16" y="48" width="32" height="7" rx="2.5" />
    </svg>
  );
}
