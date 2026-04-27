import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CreateTikTokProductInput,
  CreateTikTokProductOutput,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

export async function create_tiktok_product(
  input: CreateTikTokProductInput,
  context: AgentToolExecutionContext,
): Promise<CreateTikTokProductOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.product.createProduct({
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      save_mode: input.saveMode ?? "LISTING",
      main_images: input.mainImageUris.map((uri) => ({ uri })),
      skus: input.skus.map((sku) => ({
        seller_sku: sku.sellerSku,
        price: {
          amount: sku.priceAmount,
          currency: sku.currency,
        },
        inventory: [{
          warehouse_id: sku.warehouseId,
          quantity: sku.quantity,
        }],
        sales_attributes: [],
        list_price: sku.listPriceAmount
          ? {
              amount: sku.listPriceAmount,
              currency: sku.currency,
            }
          : undefined,
      })),
      package_weight: {
        value: input.packageWeightValue,
        unit: input.packageWeightUnit,
      },
      package_dimensions: input.packageLength && input.packageWidth && input.packageHeight
        ? {
            length: input.packageLength,
            width: input.packageWidth,
            height: input.packageHeight,
            unit: input.packageDimensionUnit ?? "CENTIMETER",
          }
        : undefined,
      external_product_id: input.externalProductId,
      listing_platforms: ["TIKTOK_SHOP"],
      category_version: "v2",
    });

    const data = response.data as { product_id?: string; skus?: Array<{ id?: string }>; warnings?: Array<{ message?: string }> } | undefined;
    if (!data?.product_id) {
      throw new Error("TikTok product creation did not return a product id.");
    }

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/product/202309/products`,
      productId: data.product_id,
      skuIds: (data.skus ?? []).map((sku) => sku.id).filter((id): id is string => typeof id === "string"),
      warnings: (data.warnings ?? []).map((warning) => warning.message).filter((message): message is string => typeof message === "string"),
    };
  });
}

export const createTikTokProductTool: AgentToolDefinition<
  "create_tiktok_product",
  CreateTikTokProductInput,
  CreateTikTokProductOutput
> = {
  name: "create_tiktok_product",
  description: "Create a TikTok Shop product listing from prepared category, image, pricing, and inventory inputs.",
  stage: "listing",
  risk: "medium",
  requiresApproval: false,
  execute: create_tiktok_product,
};