import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  SearchTikTokOrdersInput,
  SearchTikTokOrdersOutput,
  TikTokOrderSummary,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

function mapOrder(order: {
  id?: string;
  status?: string;
  create_time?: number;
  update_time?: number;
  buyer_email?: string;
  recipient_address?: { full_address?: string };
  payment?: { currency?: string; total_amount?: string };
  line_items?: Array<unknown>;
}): TikTokOrderSummary | undefined {
  if (
    typeof order.id !== "string" ||
    typeof order.status !== "string" ||
    typeof order.create_time !== "number" ||
    typeof order.update_time !== "number"
  ) {
    return undefined;
  }

  return {
    id: order.id,
    status: order.status,
    createTime: order.create_time,
    updateTime: order.update_time,
    buyerEmail: order.buyer_email,
    recipientFullAddress: order.recipient_address?.full_address,
    paymentCurrency: order.payment?.currency,
    paymentTotalAmount: order.payment?.total_amount,
    lineItemCount: Array.isArray(order.line_items) ? order.line_items.length : 0,
  };
}

export async function search_tiktok_orders(
  input: SearchTikTokOrdersInput,
  context: AgentToolExecutionContext,
): Promise<SearchTikTokOrdersOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.order.getOrderList({
      query: {
        page_size: Math.max(1, Math.min(input.pageSize ?? 20, 100)),
        page_token: input.pageToken,
      },
      body: {
        order_status: input.orderStatus,
        create_time_ge: input.createTimeGe,
        create_time_lt: input.createTimeLt,
        update_time_ge: input.updateTimeGe,
      },
    });

    const orders = (response.data?.orders ?? []).map(mapOrder).filter((order): order is TikTokOrderSummary => Boolean(order));

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/order/202309/list`,
      orders,
      nextPageToken: response.data?.next_page_token,
      hasMore: Boolean(response.data?.next_page_token),
    };
  });
}

export const searchTikTokOrdersTool: AgentToolDefinition<
  "search_tiktok_orders",
  SearchTikTokOrdersInput,
  SearchTikTokOrdersOutput
> = {
  name: "search_tiktok_orders",
  description: "Search TikTok Shop orders so the agent can see paid and awaiting-shipment work before syncing to CJ.",
  stage: "monitoring",
  risk: "low",
  requiresApproval: false,
  execute: search_tiktok_orders,
};