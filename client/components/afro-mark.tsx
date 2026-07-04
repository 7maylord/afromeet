/**
 * AfroMeet mark — a cowrie shell: Africa's original currency and the platform's
 * thesis (creators get paid). The grooves double as vinyl record lines.
 * Monochrome via currentColor.
 */
export default function AfroMark({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const teeth = Array.from({ length: 9 }, (_, i) => 25 + i * 5.55);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M50 4 C63 5 75 24 76 47 C77 72 64 96 50 96 C36 96 23 72 24 47 C25 24 37 5 50 4 Z M50 17 C43 17 39.5 32 39.5 50 C39.5 68 43 83 50 83 C57 83 60.5 68 60.5 50 C60.5 32 57 17 50 17 Z"
      />
      <g fill="currentColor">
        {teeth.map((y) => (
          <rect key={y} x="38" y={y} width="24" height="1.9" rx="0.95" />
        ))}
      </g>
    </svg>
  );
}
