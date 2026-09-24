import { NextRequest, NextResponse } from "next/server";
import {
  PRESETS,
  PROVIDER_IDS,
  apiKeyFor,
  baseUrlFor,
  composioReady,
  loadAgentsConfig,
  providerConfigured,
  saveAgentsConfig,
  setSecret,
  type ProviderId,
} from "@/lib/server/providers";
import { listModels, providerStatus } from "@/lib/server/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cfg = loadAgentsConfig();
  const only = req.nextUrl.searchParams.get("id") as ProviderId | null;
  const probe = req.nextUrl.searchParams.get("probe") === "1" || Boolean(only);
  const ids = only && PROVIDER_IDS.includes(only) ? [only] : PROVIDER_IDS;
  const providers = await Promise.all(
    ids.map(async (id) => {
      const def = PRESETS[id];
      const row = {
        id,
        label: def.label,
        local: Boolean(def.local),
        openaiCompatible: def.openaiCompatible,
        keyName: def.keyName || null,
        hasKey: def.keyName ? Boolean(apiKeyFor(id)) : true,
        baseUrl: baseUrlFor(id) || null,
        configured: providerConfigured(id),
      };
      if (!probe) {
        return { ...row, ok: row.configured, reason: row.configured ? "saved" : "not tested" };
      }
      const status = await providerStatus(id);
      return { ...row, ok: status.ok, reason: status.reason };
    }),
  );
  const modelsFor = (only && PROVIDER_IDS.includes(only) ? only : cfg.provider);
  const models = probe ? await listModels(modelsFor) : [];
  return NextResponse.json({ config: cfg, providers, models, composioReady: composioReady() });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.provider) patch.provider = body.provider;
  if (typeof body.model === "string") patch.model = body.model;
  if (typeof body.temperature === "number") patch.temperature = body.temperature;
  if (typeof body.composio === "boolean") patch.composio = body.composio;
  if (body.baseUrls && typeof body.baseUrls === "object") {
    patch.baseUrls = { ...loadAgentsConfig().baseUrls, ...body.baseUrls };
  }
  // save a secret (API key) locally
  if (body.secretName && typeof body.secretValue === "string") {
    setSecret(String(body.secretName), String(body.secretValue));
  }
  const cfg = saveAgentsConfig(patch);
  const modelsFor = (body.modelsFor as ProviderId) || cfg.provider;
  const models = await listModels(modelsFor);
  const testedId = body.testId && PROVIDER_IDS.includes(body.testId) ? (body.testId as ProviderId) : null;
  const test = testedId ? await providerStatus(testedId) : null;
  return NextResponse.json({ config: cfg, models, test: test ? { id: testedId, ...test } : null });
}
