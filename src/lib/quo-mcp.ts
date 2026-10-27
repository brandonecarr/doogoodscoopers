/**
 * Quo MCP connection — how the CRM reaches Sona (Quo's AI agent) for outbound calls.
 *
 * Quo exposes Sona's outbound calling ONLY through its remote MCP server
 * (https://mcp.quo.com/mcp, OAuth 2.1 + PKCE, dynamic client registration), not
 * the REST API. So the CRM acts as an MCP client: the owner connects once from
 * Settings (a Quo sign-in in the browser), the tokens live in AppSetting, and the
 * transport refreshes them on expiry. The connection is bound to the Quo user who
 * signed in, who must be a member of the number Sona calls from.
 *
 * AppSetting keys (the admin settings API hides any key matching /secret|token/i):
 *   quo.mcp.client.secretInfo   registered OAuth client (JSON)            hidden
 *   quo.mcp.tokens              access/refresh tokens (JSON)              hidden
 *   quo.mcp.verifierSecret      PKCE verifier for the in-flight login     hidden
 *   quo.mcp.stateSecret         OAuth state for the in-flight login       hidden
 *   quo.mcp.connectedAt / connectedBy / scope / lastError                 visible
 */
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { auth, UnauthorizedError, type OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

export const QUO_MCP_URL = "https://mcp.quo.com/mcp";
/** Everything Sona calls + reading the results need, plus texting/contacts for later. */
export const QUO_MCP_SCOPE = "read:account read:calls write:calls read:agents write:agents read:conversations write:conversations write:contacts";

const K = {
  client: "quo.mcp.client.secretInfo",
  tokens: "quo.mcp.tokens",
  verifier: "quo.mcp.verifierSecret",
  state: "quo.mcp.stateSecret",
  connectedAt: "quo.mcp.connectedAt",
  connectedBy: "quo.mcp.connectedBy",
  scope: "quo.mcp.scope",
  lastError: "quo.mcp.lastError",
  tokensAt: "quo.mcp.tokensAt",
};

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://doogoodscoopers.vercel.app").replace(/\/$/, "");
}

async function getSetting(key: string): Promise<string | null> {
  return (await prisma.appSetting.findUnique({ where: { key } }))?.value ?? null;
}
async function setSetting(key: string, value: string): Promise<void> {
  await prisma.appSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
async function delSettings(keys: string[]): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: { in: keys } } });
}

/**
 * OAuthClientProvider backed by AppSetting. `redirectToAuthorization` can't redirect
 * from a library, so it records the URL; the connect route reads `pendingAuthUrl`
 * and issues the redirect itself.
 */
export class QuoOAuthProvider implements OAuthClientProvider {
  pendingAuthUrl: URL | null = null;

  get redirectUrl(): string { return `${appUrl()}/api/admin/quo-mcp/callback`; }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "DooGoodScoopers CRM",
      client_uri: appUrl(),
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none", // public client + PKCE (Quo supports "none")
      scope: QUO_MCP_SCOPE,
    };
  }

  async state(): Promise<string> {
    const s = crypto.randomBytes(16).toString("hex");
    await setSetting(K.state, s);
    return s;
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    const raw = await getSetting(K.client);
    if (!raw) return undefined;
    try { return JSON.parse(raw) as OAuthClientInformationMixed; } catch { return undefined; }
  }
  async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
    await setSetting(K.client, JSON.stringify(info));
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const raw = await getSetting(K.tokens);
    if (!raw) return undefined;
    try { return JSON.parse(raw) as OAuthTokens; } catch { return undefined; }
  }
  async saveTokens(tokens: OAuthTokens): Promise<void> {
    // Rotating refresh tokens: a response without one keeps the previous refresh token.
    if (!tokens.refresh_token) {
      const prev = await this.tokens();
      if (prev?.refresh_token) tokens = { ...tokens, refresh_token: prev.refresh_token };
    }
    await setSetting(K.tokens, JSON.stringify(tokens));
    await setSetting(K.tokensAt, new Date().toISOString());
    if (tokens.scope) await setSetting(K.scope, tokens.scope);
    await delSettings([K.lastError]);
  }

  async redirectToAuthorization(url: URL): Promise<void> { this.pendingAuthUrl = url; }

  async saveCodeVerifier(v: string): Promise<void> { await setSetting(K.verifier, v); }
  async codeVerifier(): Promise<string> {
    const v = await getSetting(K.verifier);
    if (!v) throw new Error("No PKCE verifier saved — start the Quo connection again from Settings.");
    return v;
  }

  async invalidateCredentials(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): Promise<void> {
    if (scope === "all") await delSettings([K.client, K.tokens, K.verifier, K.state, K.tokensAt]);
    else if (scope === "client") await delSettings([K.client]);
    else if (scope === "tokens") await delSettings([K.tokens, K.tokensAt]);
    else if (scope === "verifier") await delSettings([K.verifier]);
  }
}

/** Step 1 of the login: returns the Quo authorization URL to send the browser to. */
export async function beginQuoConnect(): Promise<URL> {
  const provider = new QuoOAuthProvider();
  // A fresh login always starts from clean tokens so a stale refresh token can't short-circuit it.
  await provider.invalidateCredentials("tokens");
  const result = await auth(provider, { serverUrl: QUO_MCP_URL, scope: QUO_MCP_SCOPE });
  if (result === "REDIRECT" && provider.pendingAuthUrl) return provider.pendingAuthUrl;
  throw new Error(`Unexpected auth result: ${result}`);
}

/** Step 2: the callback. Verifies `state`, exchanges the code, stores the tokens. */
export async function finishQuoConnect(code: string, state: string | null, byEmail: string): Promise<void> {
  const expected = await getSetting(K.state);
  if (!expected || !state || state !== expected) throw new Error("OAuth state mismatch — start the connection again.");
  const provider = new QuoOAuthProvider();
  const result = await auth(provider, { serverUrl: QUO_MCP_URL, authorizationCode: code, scope: QUO_MCP_SCOPE });
  if (result !== "AUTHORIZED") throw new Error(`Unexpected auth result: ${result}`);
  await delSettings([K.state, K.verifier]);
  await setSetting(K.connectedAt, new Date().toISOString());
  await setSetting(K.connectedBy, byEmail);
}

export async function disconnectQuo(): Promise<void> {
  const provider = new QuoOAuthProvider();
  await provider.invalidateCredentials("all");
  await delSettings([K.connectedAt, K.connectedBy, K.scope, K.lastError]);
}

export interface QuoMcpStatus {
  connected: boolean;
  connectedAt: string | null;
  connectedBy: string | null;
  tokensAt: string | null;
  scope: string | null;
  lastError: string | null;
}
export async function quoMcpStatus(): Promise<QuoMcpStatus> {
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: "quo.mcp." } } });
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    connected: !!m[K.tokens],
    connectedAt: m[K.connectedAt] ?? null,
    connectedBy: m[K.connectedBy] ?? null,
    tokensAt: m[K.tokensAt] ?? null,
    scope: m[K.scope] ?? null,
    lastError: m[K.lastError] ?? null,
  };
}

/** Error thrown when the connection is missing or Quo rejected the token (owner must reconnect). */
export class QuoNotConnectedError extends Error {
  constructor(msg = "Quo is not connected. Connect it from Settings → Sona calls.") { super(msg); this.name = "QuoNotConnectedError"; }
}

type ToolResult = { text: string; json: unknown; isError: boolean };

/**
 * Call one Quo MCP tool with a fresh session (connect → call → close). Sessions are
 * cheap and this keeps serverless invocations stateless. Returns the tool's text
 * content and, when that text is JSON, the parsed value.
 */
export async function quoMcpCallTool(name: string, args: Record<string, unknown> = {}): Promise<ToolResult> {
  const provider = new QuoOAuthProvider();
  if (!(await provider.tokens())) throw new QuoNotConnectedError();
  const transport = new StreamableHTTPClientTransport(new URL(QUO_MCP_URL), { authProvider: provider });
  const client = new Client({ name: "doogoodscoopers-crm", version: "1.0.0" });
  try {
    await client.connect(transport);
    const res = await client.callTool({ name, arguments: args });
    const content = (res.content as Array<{ type: string; text?: string }> | undefined) ?? [];
    const text = content.filter((c) => c.type === "text" && typeof c.text === "string").map((c) => c.text as string).join("\n");
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* plain text */ }
    const isError = !!(res as { isError?: boolean }).isError;
    if (isError) await setSetting(K.lastError, `${name}: ${text.slice(0, 300)}`).catch(() => {});
    return { text, json, isError };
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      await setSetting(K.lastError, `Quo rejected the connection (${new Date().toISOString()}). Reconnect from Settings.`).catch(() => {});
      throw new QuoNotConnectedError("Quo rejected the saved connection. Reconnect it from Settings → Sona calls.");
    }
    throw e;
  } finally {
    await client.close().catch(() => {});
  }
}

/** The Quo numbers (inboxes) the connected user can call from. */
export async function quoInboxes(): Promise<Array<{ id: string; number: string; name: string; users: string }>> {
  const r = await quoMcpCallTool("list-inboxes");
  if (Array.isArray(r.json)) return r.json as Array<{ id: string; number: string; name: string; users: string }>;
  // The tool answers as a small text table: "id | number | name | users" rows.
  const out: Array<{ id: string; number: string; name: string; users: string }> = [];
  for (const line of r.text.split("\n")) {
    const cells = line.split("|").map((s) => s.trim());
    if (cells.length >= 3 && /^\+?\d{10,15}$/.test(cells[1]) && cells[0] !== "id") out.push({ id: cells[0], number: cells[1], name: cells[2] ?? "", users: cells[3] ?? "" });
  }
  return out;
}
