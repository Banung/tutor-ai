import {
  TUTOR_STUDIO_TYPE_META,
  type TutorStudioArtifactDto,
} from "./studio-schema";

/** Sanitize an artifact title into a safe lowercase filename with the given extension. */
export function buildStudioExportFilename(
  title: string,
  extension: "md" | "pdf"
): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  const baseName = slug || "studio-tutor";
  return `${baseName}.${extension}`;
}

/** Escape HTML special characters for safe interpolation inside print markup. */
export function escapeStudioHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatStudioIndonesianDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** Format a Studio artifact plus its cited source metadata into a clean Markdown document. */
export function buildStudioArtifactMarkdown(
  artifact: TutorStudioArtifactDto
): string {
  const meta = TUTOR_STUDIO_TYPE_META[artifact.type];
  const lines: string[] = [
    `# ${artifact.title}`,
    "",
    `- Tipe: ${meta.label}`,
    `- Tanggal: ${formatStudioIndonesianDate(artifact.createdAt)}`,
  ];

  if (artifact.materialTitles.length > 0) {
    lines.push(`- Materi: ${artifact.materialTitles.join(", ")}`);
  }

  lines.push("", artifact.content.trim());

  if (artifact.sources.length > 0) {
    lines.push("", "## Referensi Sumber", "");
    artifact.sources.forEach((source, index) => {
      lines.push(
        `${index + 1}. [Sumber ${index + 1}] ${source.materialTitle} (${source.sessionTitle}, Halaman ${source.pageNumber})`
      );
    });
  }

  lines.push("");
  return lines.join("\n");
}

/**
 * Wrap already-rendered Markdown/KaTeX HTML in a clean printable A4 HTML document
 * ready for same-origin hidden-iframe printing to PDF.
 */
export function buildStudioPrintableHtml(input: {
  artifact: TutorStudioArtifactDto;
  renderedBodyHtml: string;
  styleTagsHtml?: string;
}): string {
  const { artifact, renderedBodyHtml, styleTagsHtml = "" } = input;
  const meta = TUTOR_STUDIO_TYPE_META[artifact.type];
  const dateLabel = formatStudioIndonesianDate(artifact.createdAt);
  const materialsLabel =
    artifact.materialTitles.length > 0
      ? artifact.materialTitles.join(", ")
      : "Materi pilihan";

  const sourcesHtml =
    artifact.sources.length > 0
      ? `<section class="studio-print-sources">
          <h2>Referensi Sumber Materi</h2>
          <ol>
            ${artifact.sources
              .map(
                (source, index) =>
                  `<li><strong>[Sumber ${index + 1}]</strong> ${escapeStudioHtml(
                    source.materialTitle
                  )} (${escapeStudioHtml(source.sessionTitle)}, Halaman ${
                    source.pageNumber
                  })</li>`
              )
              .join("")}
          </ol>
        </section>`
      : "";

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <title>${escapeStudioHtml(artifact.title)}</title>
  ${styleTagsHtml}
  <style>
    @page {
      size: A4;
      margin: 16mm 18mm;
    }
    html, body {
      background: #ffffff !important;
      color: #18181b !important;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11pt;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    .studio-print-shell {
      max-width: 100%;
    }
    .studio-print-header {
      border-bottom: 1.5px solid #e4e4e7;
      margin-bottom: 18px;
      padding-bottom: 12px;
    }
    .studio-print-badge {
      display: inline-block;
      border: 1px solid #d4d4d8;
      border-radius: 999px;
      font-size: 9pt;
      font-weight: 600;
      padding: 2px 10px;
      margin-bottom: 8px;
      color: #3f3f46;
      background: #f4f4f5;
    }
    .studio-print-header h1 {
      font-size: 20pt;
      line-height: 1.25;
      margin: 0 0 8px 0;
      color: #09090b;
    }
    .studio-print-meta {
      font-size: 9.5pt;
      color: #52525b;
      margin: 0;
    }
    .studio-print-body h1,
    .studio-print-body h2,
    .studio-print-body h3 {
      break-after: avoid;
      color: #09090b;
      margin-top: 1.25em;
    }
    .studio-print-body pre,
    .studio-print-body blockquote,
    .studio-print-body table {
      break-inside: avoid;
    }
    .studio-print-body table {
      border-collapse: collapse;
      width: 100%;
      margin: 12px 0;
    }
    .studio-print-body th,
    .studio-print-body td {
      border: 1px solid #d4d4d8;
      padding: 6px 8px;
      text-align: left;
      font-size: 9.5pt;
    }
    .studio-print-body th {
      background: #f4f4f5;
    }
    .studio-print-sources {
      border-top: 1.5px solid #e4e4e7;
      margin-top: 24px;
      padding-top: 12px;
      font-size: 9.5pt;
      color: #3f3f46;
      break-inside: avoid;
    }
    .studio-print-sources h2 {
      font-size: 11.5pt;
      margin: 0 0 8px 0;
      color: #09090b;
    }
    .studio-print-sources ol {
      margin: 0;
      padding-left: 18px;
    }
    .studio-print-sources li {
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <article class="studio-print-shell">
    <header class="studio-print-header">
      <span class="studio-print-badge">Tutor AI Studio: ${escapeStudioHtml(meta.label)}</span>
      <h1>${escapeStudioHtml(artifact.title)}</h1>
      <p class="studio-print-meta">Dibuat: ${escapeStudioHtml(dateLabel)} | Materi: ${escapeStudioHtml(materialsLabel)}</p>
    </header>
    <div class="studio-print-body">
      ${renderedBodyHtml}
    </div>
    ${sourcesHtml}
  </article>
</body>
</html>`;
}
