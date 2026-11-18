export function HomeVaultIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path
        d="M16 7L7 14V24C7 24.5523 7.44772 25 8 25H24C24.5523 25 25 24.5523 25 24V14L16 7Z"
        stroke="white"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="12" y="16" width="8" height="6" rx="1.5" stroke="white" strokeWidth="1.75" />
      <circle cx="16" cy="19" r="1.2" fill="white" />
    </svg>
  );
}
