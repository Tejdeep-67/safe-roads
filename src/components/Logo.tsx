export default function Logo({ className = 'h-8 w-8' }: { className?: string }) {
  // a road narrowing to the horizon with a hazard marker on it
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#191c21" />
      <path d="M12.5 6h7l6 20h-19z" fill="#2d323a" />
      <path d="M16 8v3M16 14v3.5M16 21v4" stroke="#f5b301" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="21.2" cy="19.5" r="3.1" fill="#f43f5e" stroke="#191c21" strokeWidth="1.4" />
    </svg>
  );
}
