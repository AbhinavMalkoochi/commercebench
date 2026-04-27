import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  GetTikTokWarehousesInput,
  GetTikTokWarehousesOutput,
  TikTokWarehouseSummary,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

function mapWarehouse(warehouse: {
  id?: string;
  name?: string;
  effect_status?: string;
  is_default?: boolean;
  address?: { region_code?: string; city?: string };
}): TikTokWarehouseSummary | undefined {
  if (typeof warehouse.id !== "string") {
    return undefined;
  }

  return {
    id: warehouse.id,
    name: warehouse.name,
    effectStatus: warehouse.effect_status,
    isDefault: Boolean(warehouse.is_default),
    regionCode: warehouse.address?.region_code,
    city: warehouse.address?.city,
  };
}

export async function get_tiktok_warehouses(
  input: GetTikTokWarehousesInput,
  context: AgentToolExecutionContext,
): Promise<GetTikTokWarehousesOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.logistic.getWarehouseList();
    const warehouses = (response.data?.warehouses ?? []).map(mapWarehouse).filter((entry): entry is TikTokWarehouseSummary => Boolean(entry));

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/logistics/202309/warehouses`,
      warehouses,
    };
  });
}

export const getTikTokWarehousesTool: AgentToolDefinition<
  "get_tiktok_warehouses",
  GetTikTokWarehousesInput,
  GetTikTokWarehousesOutput
> = {
  name: "get_tiktok_warehouses",
  description: "Get TikTok Shop warehouses so live listing creation can attach real inventory locations.",
  stage: "listing",
  risk: "low",
  requiresApproval: false,
  execute: get_tiktok_warehouses,
};