import { ToolExecutor } from "@/agent/core/tool-executor";
import { DefaultToolPolicy } from "@/agent/core/tool-policy";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import { AgentToolExecutionContext } from "@/agent/core/tools";
import { ListingDraftResult, ProductExecutionResult, RESTRICTED_PRODUCT_KEYWORDS, TikTokListingExecutionResult } from "@/agent/core/types";

export interface TikTokListingPublishConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  shopCipher: string;
  currency: string;
  defaultInventoryQuantity: number;
  defaultWarehouseId?: string;
  packageWeightValue: string;
  packageWeightUnit: string;
  packageLength?: string;
  packageWidth?: string;
  packageHeight?: string;
  packageDimensionUnit?: string;
  activateAfterCreate?: boolean;
}

export class TikTokListingPublisher {
  private readonly executor = new ToolExecutor(createDefaultToolRegistry());
  private readonly policy = new DefaultToolPolicy();

  private hasRestrictedContent(input: {
    title: string;
    subtitle: string;
    description: string;
    bullets: string[];
    tags: string[];
  }): boolean {
    const combined = [
      input.title,
      input.subtitle,
      input.description,
      ...input.bullets,
      ...input.tags,
    ].join(" ").toLowerCase();

    return RESTRICTED_PRODUCT_KEYWORDS.some((keyword) => combined.includes(keyword));
  }

  async publish(input: {
    draft?: ListingDraftResult;
    productExecution?: ProductExecutionResult;
    config?: TikTokListingPublishConfig;
    toolContext: AgentToolExecutionContext;
  }): Promise<TikTokListingExecutionResult> {
    if (!input.config) {
      return {
        status: "skipped",
        reasoning: "TikTok listing publish configuration is not present.",
      };
    }

    const artifact = input.draft?.artifact;
    if (!artifact) {
      return {
        status: "skipped",
        reasoning: "TikTok listing publish requires a prepared listing draft artifact.",
      };
    }

    if (this.hasRestrictedContent(artifact)) {
      return {
        status: "blocked",
        reasoning: "TikTok listing publish blocked the draft because it appears to fall into a restricted product category.",
      };
    }

    const imageUrl = artifact.heroImageUrl;
    if (!imageUrl) {
      return {
        status: "blocked",
        reasoning: "TikTok listing publish requires a real product image URL from the provider selection.",
      };
    }

    const listingDecision = this.policy.evaluate(this.executor.getToolDefinition("upload_tiktok_product_image"), {
      stage: "listing",
    });
    if (!listingDecision.allowed) {
      return {
        status: "blocked",
        reasoning: listingDecision.reason,
      };
    }

    const warehouseId = input.config.defaultWarehouseId ?? await this.resolveWarehouseId(input.config, input.toolContext);
    const category = await this.executor.execute(
      "recommend_tiktok_category",
      {
        appKey: input.config.appKey,
        appSecret: input.config.appSecret,
        accessToken: input.config.accessToken,
        shopCipher: input.config.shopCipher,
        title: artifact.title,
        description: artifact.description,
        imageUrls: [imageUrl],
      },
      input.toolContext,
    );

    const uploadedImage = await this.executor.execute(
      "upload_tiktok_product_image",
      {
        appKey: input.config.appKey,
        appSecret: input.config.appSecret,
        accessToken: input.config.accessToken,
        shopCipher: input.config.shopCipher,
        imageUrl,
      },
      input.toolContext,
    );

    const sellerSku = this.resolveSellerSku(input.productExecution, artifact.productHandle);
    const created = await this.executor.execute(
      "create_tiktok_product",
      {
        appKey: input.config.appKey,
        appSecret: input.config.appSecret,
        accessToken: input.config.accessToken,
        shopCipher: input.config.shopCipher,
        title: artifact.title,
        description: artifact.description,
        categoryId: category.categoryId,
        mainImageUris: [uploadedImage.uri],
        skus: [
          {
            sellerSku,
            priceAmount: artifact.retailPrice.toFixed(2),
            listPriceAmount: artifact.compareAtPrice?.toFixed(2),
            currency: input.config.currency,
            warehouseId,
            quantity: input.config.defaultInventoryQuantity,
          },
        ],
        packageWeightValue: input.config.packageWeightValue,
        packageWeightUnit: input.config.packageWeightUnit,
        packageLength: input.config.packageLength,
        packageWidth: input.config.packageWidth,
        packageHeight: input.config.packageHeight,
        packageDimensionUnit: input.config.packageDimensionUnit,
        saveMode: input.config.activateAfterCreate ? "LISTING" : "DRAFT",
        externalProductId: artifact.productHandle,
      },
      input.toolContext,
    );

    if (input.config.activateAfterCreate) {
      await this.executor.execute(
        "activate_tiktok_products",
        {
          appKey: input.config.appKey,
          appSecret: input.config.appSecret,
          accessToken: input.config.accessToken,
          shopCipher: input.config.shopCipher,
          productIds: [created.productId],
        },
        input.toolContext,
      );
    }

    return {
      status: "ready",
      reasoning: `Created TikTok product ${created.productId} from the prepared listing draft and provider image.`,
      productId: created.productId,
      skuIds: created.skuIds,
      categoryId: category.categoryId,
      warehouseId,
      imageUris: [uploadedImage.uri],
      warnings: created.warnings,
    };
  }

  private async resolveWarehouseId(config: TikTokListingPublishConfig, toolContext: AgentToolExecutionContext): Promise<string> {
    const warehouses = await this.executor.execute(
      "get_tiktok_warehouses",
      {
        appKey: config.appKey,
        appSecret: config.appSecret,
        accessToken: config.accessToken,
        shopCipher: config.shopCipher,
      },
      toolContext,
    );
    const selected = warehouses.warehouses.find((warehouse) => warehouse.isDefault) ?? warehouses.warehouses[0];

    if (!selected) {
      throw new Error("TikTok listing publish requires at least one warehouse.");
    }

    return selected.id;
  }

  private resolveSellerSku(productExecution: ProductExecutionResult | undefined, fallback: string): string {
    if (
      productExecution &&
      "selection" in productExecution &&
      productExecution.selection &&
      "sku" in productExecution.selection &&
      typeof productExecution.selection.sku === "string"
    ) {
      return productExecution.selection.sku;
    }

    return fallback;
  }
}