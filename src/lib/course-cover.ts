type CoverInput = {
  id: string;
  title: string;
  enrollmentKey: string;
};

const COVER_VERSION = "course-cover-v3";

type Palette = {
  base: string;
  light: string;
  soft: string;
  accent: string;
  muted: string;
};

const PALETTES: Record<string, Palette[]> = {
  computing: [
    { base: "#78c7ff", light: "#e8f7ff", soft: "#aee2ff", accent: "#60a5fa", muted: "#d7efff" },
    { base: "#95d5b2", light: "#ecfff4", soft: "#b7e4c7", accent: "#74c69d", muted: "#dcf7e8" },
    { base: "#c7b7ff", light: "#f2eeff", soft: "#d9ccff", accent: "#a78bfa", muted: "#ebe5ff" },
    { base: "#ffd166", light: "#fff4d6", soft: "#ffe09a", accent: "#f4b942", muted: "#fff0c2" },
  ],
  science: [
    { base: "#70d6c7", light: "#e4fbf7", soft: "#a7eadf", accent: "#54b8ac", muted: "#d8f7f1" },
    { base: "#b8e986", light: "#f1fbdf", soft: "#d2f3ad", accent: "#99d26a", muted: "#e7f7d0" },
    { base: "#8bd3ff", light: "#ebf8ff", soft: "#bde9ff", accent: "#65bce7", muted: "#ddf3ff" },
  ],
  design: [
    { base: "#ffafcc", light: "#fff0f6", soft: "#ffc8dd", accent: "#f284b6", muted: "#ffe3ee" },
    { base: "#ffc971", light: "#fff3dc", soft: "#ffdda3", accent: "#f2aa4c", muted: "#ffefd1" },
    { base: "#fdc5f5", light: "#fff0fd", soft: "#f7d6ff", accent: "#d8a0e8", muted: "#fae6ff" },
  ],
  business: [
    { base: "#a0c4ff", light: "#edf4ff", soft: "#c8dcff", accent: "#7aa7f7", muted: "#dfebff" },
    { base: "#bde0fe", light: "#f0f8ff", soft: "#d3ecff", accent: "#8ec5f0", muted: "#e4f4ff" },
    { base: "#cddafd", light: "#f2f5ff", soft: "#dee6ff", accent: "#9fb4f4", muted: "#e9eeff" },
  ],
  humanities: [
    { base: "#e7c6ff", light: "#faf1ff", soft: "#f0d7ff", accent: "#c99ee8", muted: "#f4e6ff" },
    { base: "#ffd6a5", light: "#fff4e8", soft: "#ffe4bf", accent: "#f2b36f", muted: "#fff0dd" },
    { base: "#ffcad4", light: "#fff0f2", soft: "#ffe0e6", accent: "#f0a7b5", muted: "#ffe9ee" },
  ],
  neutral: [
    { base: "#ffafcc", light: "#fff1f7", soft: "#ffc8dd", accent: "#f17ead", muted: "#ffe5ef" },
    { base: "#a0c4ff", light: "#eff6ff", soft: "#bde0fe", accent: "#83b6f4", muted: "#e4f1ff" },
    { base: "#caffbf", light: "#f2ffef", soft: "#d9ffd1", accent: "#9ce38e", muted: "#e6ffdf" },
    { base: "#fdffb6", light: "#ffffee", soft: "#fff4a8", accent: "#e8d95c", muted: "#fffbd1" },
    { base: "#bdb2ff", light: "#f3f0ff", soft: "#d8ccff", accent: "#a18cf0", muted: "#ece7ff" },
    { base: "#9bf6ff", light: "#efffff", soft: "#c8fbff", accent: "#72dce8", muted: "#defdff" },
    { base: "#ffc6ff", light: "#fff0ff", soft: "#f7d0ff", accent: "#dc9be8", muted: "#fae4ff" },
    { base: "#ffd6a5", light: "#fff4e8", soft: "#ffe2ba", accent: "#f0b26c", muted: "#ffedd6" },
  ],
};

const KEYWORD_PALETTES = [
  {
    palette: "computing",
    keywords: ["ai", "komput", "informatika", "data", "software", "program", "siber", "machine", "algorit"],
  },
  {
    palette: "science",
    keywords: ["biologi", "kimia", "fisika", "sains", "statistik", "matematika", "lingkungan"],
  },
  {
    palette: "design",
    keywords: ["desain", "media", "visual", "seni", "arsitektur", "kreatif"],
  },
  {
    palette: "business",
    keywords: ["bisnis", "ekonomi", "manajemen", "akuntansi", "keuangan", "pemasaran"],
  },
  {
    palette: "humanities",
    keywords: ["hukum", "sosial", "komunikasi", "bahasa", "sejarah", "politik", "filsafat"],
  },
] as const;

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createRandom(seed: number) {
  let state = seed || 1;

  return () => {
    state = Math.imul(1664525, state) + 1013904223;
    return (state >>> 0) / 4294967296;
  };
}

function getPalette(title: string, random: () => number) {
  const lowerTitle = title.toLowerCase();
  const matched = KEYWORD_PALETTES.find(({ keywords }) =>
    keywords.some((keyword) => lowerTitle.includes(keyword))
  );
  const paletteGroup = PALETTES[matched?.palette ?? "neutral"];

  return paletteGroup[Math.floor(random() * paletteGroup.length)];
}

function createTileShapes(random: () => number, palette: Palette) {
  const colors = [palette.base, palette.soft, palette.accent, palette.muted];
  const tileSize = [96, 120, 150][Math.floor(random() * 3)];
  const columns = Math.ceil(1200 / tileSize) + 1;
  const rows = Math.ceil(480 / tileSize) + 1;
  const offsetX = Math.round(random() * tileSize * -0.6);
  const offsetY = Math.round(random() * tileSize * -0.5);

  return Array.from({ length: columns * rows }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = column * tileSize + offsetX;
    const y = row * tileSize + offsetY;
    const color = colors[Math.floor(random() * colors.length)];
    const opacity = 0.2 + random() * 0.34;
    const variant = Math.floor(random() * 6);

    const points = [
      `${x},${y} ${x + tileSize},${y} ${x},${y + tileSize}`,
      `${x + tileSize},${y} ${x + tileSize},${y + tileSize} ${x},${y + tileSize}`,
      `${x},${y} ${x + tileSize},${y} ${x + tileSize},${y + tileSize} ${x},${y + tileSize}`,
      `${x + tileSize / 2},${y} ${x + tileSize},${y + tileSize / 2} ${x + tileSize / 2},${y + tileSize} ${x},${y + tileSize / 2}`,
      `${x},${y + tileSize / 2} ${x + tileSize / 2},${y} ${x + tileSize},${y + tileSize / 2} ${x + tileSize / 2},${y + tileSize}`,
      `${x},${y} ${x + tileSize},${y} ${x + tileSize},${y + tileSize}`,
    ];

    return `<polygon points="${points[variant]}" fill="${color}" opacity="${opacity.toFixed(2)}"/>`;
  }).join("");
}

export function generateCourseCover({ id, title, enrollmentKey }: CoverInput) {
  const random = createRandom(hashString(`${id}-${title}-${enrollmentKey}`));
  const palette = getPalette(title, random);
  const rotation = Math.round(random() * 12 - 6);
  const gradientId = `g${hashString(id).toString(16)}`;
  const glowId = `r${hashString(`${id}-glow`).toString(16)}`;
  const pattern = createTileShapes(random, palette);
  const glowX = Math.round(220 + random() * 760);
  const glowY = Math.round(80 + random() * 280);
  const secondGlowX = Math.round(120 + random() * 940);
  const secondGlowY = Math.round(80 + random() * 320);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 480" preserveAspectRatio="xMidYMid slice">
      <metadata>${COVER_VERSION}</metadata>
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette.soft}"/>
          <stop offset="46%" stop-color="${palette.light}"/>
          <stop offset="100%" stop-color="${palette.base}"/>
        </linearGradient>
        <radialGradient id="${glowId}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="12" stdDeviation="20" flood-color="${palette.accent}" flood-opacity="0.14"/>
        </filter>
      </defs>
      <rect width="1200" height="480" fill="url(#${gradientId})"/>
      <g transform="rotate(${rotation} 600 240)" filter="url(#softShadow)">
        ${pattern}
      </g>
      <circle cx="${glowX}" cy="${glowY}" r="210" fill="url(#${glowId})"/>
      <circle cx="${secondGlowX}" cy="${secondGlowY}" r="150" fill="#ffffff" opacity="0.06"/>
      <rect width="1200" height="480" fill="${palette.light}" opacity="0.03"/>
    </svg>
  `.replace(/\s+/g, " ").trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function isCurrentCourseCover(coverImage: string | null) {
  return Boolean(coverImage?.includes(COVER_VERSION));
}

/** Uploaded/admin-managed covers are not generated SVGs and must never be regenerated. */
export function isCustomCourseCover(coverImage: string | null) {
  return Boolean(coverImage && !coverImage.startsWith("data:image/svg+xml"));
}
