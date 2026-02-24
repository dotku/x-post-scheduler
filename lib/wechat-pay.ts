import { createSign, randomBytes } from "crypto";

const WECHAT_API_BASE = "https://api.mch.weixin.qq.com";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`MISSING_ENV:${name}`);
  }
  return value;
}

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_PUBLIC_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_LOCAL_URL ||
    "http://localhost:3000"
  );
}

function createNonceStr() {
  return randomBytes(16).toString("hex");
}

function signMessage(message: string, privateKey: string) {
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  signer.end();
  return signer.sign(privateKey, "base64");
}

function buildAuthorization(params: {
  method: string;
  pathWithQuery: string;
  body: string;
  mchId: string;
  serialNo: string;
  privateKey: string;
}) {
  const nonceStr = createNonceStr();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const message = `${params.method}\n${params.pathWithQuery}\n${timestamp}\n${nonceStr}\n${params.body}\n`;
  const signature = signMessage(message, params.privateKey);

  return `WECHATPAY2-SHA256-RSA2048 mchid="${params.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${params.serialNo}",signature="${signature}"`;
}

async function callWeChatApi<T>(params: {
  method: "GET" | "POST";
  pathWithQuery: string;
  body?: Record<string, unknown>;
}) {
  const mchId = getRequiredEnv("WECHAT_MCH_ID");
  const serialNo = getRequiredEnv("WECHAT_SERIAL_NO");
  const privateKey = getRequiredEnv("WECHAT_PRIVATE_KEY");

  const body = params.body ? JSON.stringify(params.body) : "";
  const authorization = buildAuthorization({
    method: params.method,
    pathWithQuery: params.pathWithQuery,
    body,
    mchId,
    serialNo,
    privateKey,
  });

  const response = await fetch(`${WECHAT_API_BASE}${params.pathWithQuery}`, {
    method: params.method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: authorization,
      "User-Agent": "xpilot-wechatpay/1.0",
    },
    body: body || undefined,
    cache: "no-store",
  });

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : ({} as T);

  if (!response.ok) {
    throw new Error(`WECHAT_API_ERROR:${response.status}:${text}`);
  }

  return data;
}

export function assertWeChatConfigReady() {
  getRequiredEnv("WECHAT_MCH_ID");
  getRequiredEnv("WECHAT_APP_ID");
  getRequiredEnv("WECHAT_SERIAL_NO");
  getRequiredEnv("WECHAT_PRIVATE_KEY");
}

export function createWechatOutTradeNo(userId: string) {
  const userSuffix = userId.replace(/[^a-zA-Z0-9]/g, "").slice(-8) || "user";
  const timestamp = Date.now().toString();
  const random = randomBytes(2).toString("hex");
  return `wx${userSuffix}${timestamp}${random}`.slice(0, 32);
}

export async function createWeChatNativeOrder(params: {
  userId: string;
  amountCents: number;
}) {
  const appId = getRequiredEnv("WECHAT_APP_ID");
  const mchId = getRequiredEnv("WECHAT_MCH_ID");
  const outTradeNo = createWechatOutTradeNo(params.userId);

  const payload = {
    appid: appId,
    mchid: mchId,
    description: `Credit top-up ${(params.amountCents / 100).toFixed(2)}`,
    out_trade_no: outTradeNo,
    notify_url:
      process.env.WECHAT_NOTIFY_URL || `${getAppBaseUrl()}/api/wechat/webhook`,
    amount: {
      total: params.amountCents,
      currency: "CNY",
    },
    attach: JSON.stringify({
      userId: params.userId,
      amountCents: params.amountCents,
      source: "xpilot_credit_topup",
    }),
  };

  const data = await callWeChatApi<{ code_url?: string }>({
    method: "POST",
    pathWithQuery: "/v3/pay/transactions/native",
    body: payload,
  });

  if (!data.code_url) {
    throw new Error("WECHAT_NO_CODE_URL");
  }

  return {
    outTradeNo,
    codeUrl: data.code_url,
  };
}

export type WeChatOrderResult = {
  tradeState: string;
  amountTotal: number;
  transactionId: string | null;
  attach: string | null;
};

export async function queryWeChatOrderByOutTradeNo(
  outTradeNo: string,
): Promise<WeChatOrderResult> {
  const mchId = getRequiredEnv("WECHAT_MCH_ID");
  const encodedOutTradeNo = encodeURIComponent(outTradeNo);
  const pathWithQuery = `/v3/pay/transactions/out-trade-no/${encodedOutTradeNo}?mchid=${encodeURIComponent(mchId)}`;

  const data = await callWeChatApi<{
    trade_state?: string;
    amount?: { total?: number };
    transaction_id?: string;
    attach?: string;
  }>({
    method: "GET",
    pathWithQuery,
  });

  return {
    tradeState: data.trade_state ?? "UNKNOWN",
    amountTotal: data.amount?.total ?? 0,
    transactionId: data.transaction_id ?? null,
    attach: data.attach ?? null,
  };
}
