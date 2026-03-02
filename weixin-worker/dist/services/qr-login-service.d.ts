import type { QrLoginStartResponse, QrLoginStatusResponse } from "../types.js";
export declare function getActiveSessionCount(): number;
export declare function startLogin(): Promise<QrLoginStartResponse>;
export declare function checkStatus(sessionId: string): Promise<QrLoginStatusResponse | null>;
export declare function cleanupAllSessions(): Promise<void>;
