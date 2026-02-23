/**
 * Vercel Blob configuration and utilities
 * Ensures proper token usage for public vs private blob storage
 */

export function getPublicBlobUrl(url: string): string {
  // If URL already contains domain info, return as-is
  if (url.includes(".blob.vercel-storage.com")) {
    return url;
  }
  // Relative URLs: prepend public domain
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (publicUrl) {
    return `${publicUrl}${url}`;
  }
  return url;
}

export function getBlobToken(type: "public" | "private"): string | undefined {
  // For files that need external provider access (Wavespeed)
  if (type === "public") {
    return (
      process.env.TOOLBOX_PUBLIC_BLOB_READ_WRITE_TOKEN ||
      process.env.PUBLIC_BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_READ_WRITE_TOKEN
    );
  }
  // For private/workspace storage
  return process.env.BLOB_READ_WRITE_TOKEN;
}

export function isLocalhost(): boolean {
  const url = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "";
  return url.includes("localhost") || url.includes("127.0.0.1");
}

/**
 * Checks if blob storage is properly configured for external provider access
 * Returns diagnostic info for debugging upload issues
 */
export function checkBlobPublicAccess() {
  const publicToken = getBlobToken("public");
  const isLocal = isLocalhost();
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL;

  return {
    hasPublicToken: !!publicToken,
    isLocal,
    publicUrl,
    isReadyForExternalAccess:
      !isLocal && publicToken && publicToken !== getBlobToken("private"),
    diagnostics: {
      message: isLocal
        ? "Running on localhost - blob files will use proxy (unreachable by external providers)"
        : publicToken
          ? "Configured for external provider access"
          : "Missing public blob token - external providers cannot access uploaded files",
      recommendations: [
        isLocal && "Deploy to production or configure public domain",
        !publicToken && "Create public token in Vercel Blob dashboard",
        publicToken === getBlobToken("private") &&
          "Separate public token needed (current config uses private token)",
      ].filter(Boolean),
    },
  };
}
