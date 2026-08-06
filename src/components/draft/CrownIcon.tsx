interface CrownIconProps {
  className?: string;
}

export function CrownIcon({ className }: CrownIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="m3 7 4.5 4L12 4l4.5 7L21 7l-2 11H5L3 7Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <path d="M6 21h12" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}
