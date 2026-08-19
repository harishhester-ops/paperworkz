const API_BASE = "https://paperworkz-server.onrender.com";

export interface ApiResult {
  blob: Blob;
  filename: string;
  contentType: string;
}

export async function callApi(
  endpoint: string,
  body: FormData,
  timeoutMs = 180_000
): Promise<ApiResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      body,
      signal: ctrl.signal,
    });

    if (!res.ok) {
      let detail = res.statusText;
      try { detail = (await res.json()).error ?? detail; } catch { /* ignore */ }
      throw new Error(detail || `HTTP ${res.status}`);
    }

    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match?.[1] ?? "download";
    const contentType = res.headers.get("content-type") ?? blob.type;

    return { blob, filename, contentType };
  } finally {
    clearTimeout(timer);
  }
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
