/** Hash a user-selected download locally; the file never leaves the browser. */
export async function fileMatchesSha256(file: Blob, expectedSha256: string): Promise<boolean> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const actual = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return actual === expectedSha256.toLowerCase();
}
