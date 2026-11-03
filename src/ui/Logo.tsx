// The Safe Roads mark: a road with a pothole on it. Same drawing as public/favicon.svg.
export default function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#2557d6" />
      <path d="M19 64C19 44 45 38 45 0" fill="none" stroke="#fff" strokeWidth="17" />
      <path d="M19 64C19 44 45 38 45 0" fill="none" stroke="#2557d6" strokeWidth="2.4" strokeDasharray="5 6" strokeDashoffset="2" />
      <ellipse cx="40" cy="35.8" rx="5.4" ry="3.1" transform="rotate(-58 40 35.8)" fill="#f26b1d" />
    </svg>
  );
}
