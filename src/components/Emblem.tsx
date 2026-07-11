export function Emblem({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden="true"
      className={className ?? "h-7 w-7"}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Little free library: a book box on a post with books inside */}

      {/* Post */}
      <rect x="29" y="46" width="6" height="13" rx="1.5" fill="#A8763E" />
      <rect x="24" y="57" width="16" height="3.5" rx="1.75" fill="#8B5E34" />

      {/* Box body */}
      <rect
        x="15"
        y="25"
        width="34"
        height="24"
        rx="3"
        fill="url(#boxFill)"
        stroke="#0F766E"
        strokeWidth="2"
      />

      {/* Glass front showing book spines */}
      <rect x="20" y="29.5" width="24" height="15.5" rx="2" fill="white" opacity="0.95" />
      <rect x="22.5" y="33" width="3.6" height="12" rx="1.2" fill="#0EA5E9" />
      <rect x="27" y="31.5" width="3.6" height="13.5" rx="1.2" fill="#10B981" />
      <rect x="31.5" y="33.5" width="3.6" height="11.5" rx="1.2" fill="#F59E0B" />
      <rect x="36" y="32.5" width="3.6" height="12.5" rx="1.2" fill="#0F766E" />

      {/* Pitched roof with overhang */}
      <path
        d="M10 27.5 32 11l22 16.5a2 2 0 0 1-1.2 3.6H11.2A2 2 0 0 1 10 27.5Z"
        fill="url(#roofFill)"
        stroke="#0F766E"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Heart finial on the roof peak */}
      <path
        d="M32 9.6c.9-1.5 3.4-1.4 4 .4.5 1.5-1 3.1-4 5-3-1.9-4.5-3.5-4-5 .6-1.8 3.1-1.9 4-.4Z"
        fill="#F59E0B"
        stroke="#92400E"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />

      <defs>
        <linearGradient id="boxFill" x1="15" y1="25" x2="49" y2="49" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ECFDF5" />
          <stop offset="1" stopColor="#FEF3C7" />
        </linearGradient>
        <linearGradient id="roofFill" x1="14" y1="11" x2="50" y2="31" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="1" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
    </svg>
  );
}
