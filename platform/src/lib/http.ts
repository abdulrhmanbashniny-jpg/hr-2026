/** Content-Disposition that keeps Arabic file names (RFC 5987) and shows PDFs and images inline. */
export function contentDisposition(name: string, mime: string): string {
  const inline = mime === 'application/pdf' || mime.startsWith('image/');
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
  return `${inline ? 'inline' : 'attachment'}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
