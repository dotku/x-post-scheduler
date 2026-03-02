import type { Page, BrowserContext } from "playwright";

export interface CookieData {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: "Strict" | "Lax" | "None";
}

export interface QrLoginSession {
  sessionId: string;
  page: Page;
  context: BrowserContext;
  createdAt: Date;
  status: "pending" | "scanned" | "success" | "expired";
  cleanupTimer: NodeJS.Timeout;
}

export interface QrLoginStartResponse {
  sessionId: string;
  qrCodeBase64: string;
  expiresAt: string;
}

export interface QrLoginStatusResponse {
  status: "pending" | "scanned" | "success" | "expired";
  message?: string;
  cookies?: CookieData[];
}

export interface ScrapeRequest {
  cookies: CookieData[];
  channelId?: string;
}

export interface VideoMeta {
  title: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  videoUrl?: string;
  objectId?: string;
  exportId?: string;
  duration?: number;
}

export interface ThumbnailData {
  url: string;
  base64: string; // data:image/jpeg;base64,...
  altText?: string;
}

export interface ScrapeResponse {
  success: boolean;
  content?: string;
  title?: string;
  videos?: VideoMeta[];
  images?: Array<{ url: string; altText?: string }>;
  thumbnails?: ThumbnailData[];
  error?: string;
  cookieExpired?: boolean;
  debugScreenshot?: string;
  debugApiUrls?: string[];
}

export interface ResolveVideoUrlsRequest {
  cookies: CookieData[];
  videos: Array<{ objectId?: string; title: string }>;
}

export interface ResolveVideoUrlsResponse {
  results: Array<{
    title: string;
    objectId?: string;
    videoUrl?: string;
    error?: string;
  }>;
}

export interface DownloadRequest {
  cookies: CookieData[];
  videoUrl: string;
  filename?: string;
}

export interface DownloadResponse {
  success: boolean;
  data?: string; // base64 encoded video data
  contentType?: string;
  filename?: string;
  size?: number;
  error?: string;
}
