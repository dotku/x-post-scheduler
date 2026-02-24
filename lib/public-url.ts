/**
 * Convert a localhost or relative URL to a publicly accessible URL
 * Used when external providers (like Wavespeed) need to access resources
 */
export function toPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  // Already a public URL
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // Replace localhost with public domain
    if (url.includes("localhost:")) {
      const publicUrl =
        process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
        process.env.NEXT_PUBLIC_APP_LOCAL_URL ||
        process.env.APP_BASE_URL;
      if (publicUrl) {
        return url.replace(/http:\/\/localhost:\d+/, publicUrl);
      }
    }
    return url;
  }

  // Relative URL - prepend public domain
  const publicUrl =
    process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_LOCAL_URL ||
    process.env.APP_BASE_URL;
  if (publicUrl) {
    return `${publicUrl}${url}`;
  }

  return url;
}
