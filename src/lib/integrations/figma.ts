export type FigmaContext = {
  name: string;
  lastModified?: string;
  version?: string;
  thumbnailUrl?: string;
  nodeNames: string[];
};

export async function fetchFigmaContext(opts: {
  token?: string | null;
  fileKey?: string | null;
}): Promise<FigmaContext | null> {
  if (!opts.token || !opts.fileKey) return null;

  const res = await fetch(`https://api.figma.com/v1/files/${opts.fileKey}?depth=1`, {
    headers: { "X-Figma-Token": opts.token },
  });
  if (!res.ok) {
    throw new Error(`Figma API error: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as {
    name: string;
    lastModified?: string;
    version?: string;
    thumbnailUrl?: string;
    document?: { children?: { name: string }[] };
  };

  return {
    name: data.name,
    lastModified: data.lastModified,
    version: data.version,
    thumbnailUrl: data.thumbnailUrl,
    nodeNames: (data.document?.children ?? []).map((c) => c.name).slice(0, 20),
  };
}
