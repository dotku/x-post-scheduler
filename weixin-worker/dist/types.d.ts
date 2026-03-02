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
}
export interface ScrapeResponse {
    success: boolean;
    content?: string;
    title?: string;
    videos?: VideoMeta[];
    images?: Array<{
        url: string;
        altText?: string;
    }>;
    error?: string;
    cookieExpired?: boolean;
}
