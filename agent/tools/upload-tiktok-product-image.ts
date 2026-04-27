import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  UploadTikTokProductImageInput,
  UploadTikTokProductImageOutput,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

export async function upload_tiktok_product_image(
  input: UploadTikTokProductImageInput,
  context: AgentToolExecutionContext,
): Promise<UploadTikTokProductImageOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  const imageResponse = await (context.fetchImpl ?? fetch)(input.imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download product image: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.product.uploadProductImage({
      data: buffer,
      use_case: input.useCase ?? "MAIN_IMAGE",
    });

    if (!response.data?.uri || !response.data.url) {
      throw new Error("TikTok image upload did not return a uri and url.");
    }

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/product/202309/images/upload`,
      uri: response.data.uri,
      url: response.data.url,
      width: response.data.width,
      height: response.data.height,
      useCase: response.data.use_case,
    };
  });
}

export const uploadTikTokProductImageTool: AgentToolDefinition<
  "upload_tiktok_product_image",
  UploadTikTokProductImageInput,
  UploadTikTokProductImageOutput
> = {
  name: "upload_tiktok_product_image",
  description: "Download and upload a product image to TikTok Shop so it can be used in a live listing.",
  stage: "listing",
  risk: "medium",
  requiresApproval: false,
  execute: upload_tiktok_product_image,
};