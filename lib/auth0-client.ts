import { Auth0Client } from "@auth0/nextjs-auth0/server";

const sanitize = (value?: string) => value?.split("#")[0].trim();

const appBaseUrl =
  sanitize(process.env.APP_BASE_URL) ?? sanitize(process.env.AUTH0_BASE_URL);

const issuerBaseUrl =
  sanitize(process.env.AUTH0_ISSUER_BASE_URL) ??
  sanitize(process.env.AUTH0_ISSUER);

const domain =
  sanitize(process.env.AUTH0_DOMAIN) ??
  (issuerBaseUrl ? issuerBaseUrl.replace(/^https?:\/\//, "") : undefined);

export const auth0 = new Auth0Client({
  appBaseUrl,
  domain,
});
