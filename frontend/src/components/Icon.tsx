export default function Icon({
  name,
  size = 20,
}: {
  name:
    | "globe"
    | "terrain"
    | "eye"
    | "play"
    | "pause"
    | "arrow"
    | "close"
    | "compare"
    | "settings"
    | "info"
    | "sun"
    | "earth"
    | "reset"
    | "download";
  size?: number;
}) {
  const paths = {
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <ellipse cx="12" cy="12" rx="4" ry="9" />
        <path d="M3 12h18" />
      </>
    ),
    terrain: (
      <>
        <path d="m2 18 6-12 5 8 3-5 6 9H2Z" />
        <path d="m8 6 1 12" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    play: <path d="m8 4 12 8-12 8V4Z" />,
    pause: (
      <>
        <path d="M8 5v14M16 5v14" />
      </>
    ),
    arrow: <path d="M4 12h15m-6-6 6 6-6 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    compare: (
      <>
        <path d="M4 5h6v14H4zM14 5h6v14h-6zM12 2v20" />
      </>
    ),
    settings: (
      <>
        <path d="M5 3v18M12 3v18M19 3v18M2 8h6m1 8h6m1-10h6" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10v1" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" />
      </>
    ),
    earth: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m5 5 7 3-2 4 4 2 1 6M20 8l-4 2 2 4" />
      </>
    ),
    reset: (
      <>
        <path d="M4 10a8 8 0 1 1 1 8M4 4v6h6" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
