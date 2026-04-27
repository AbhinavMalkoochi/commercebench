import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { ToolExecutor } from "@/agent/core/tool-executor";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";
import { executeRemoteShellCommand } from "@/agent/tools/run-remote-shell-command";

const FETCH_FIXTURE_HTML = `
  <html>
    <head><title>Research Fixture</title></head>
    <body>
      <article>Current page text for a research fixture.</article>
    </body>
  </html>
`;

const PRINTFUL_PRODUCTS_FIXTURE = {
  result: [
    {
      id: 71,
      name: "Unisex Staple T-Shirt",
      description: "A classic tee.",
      category_id: 24,
      variants: [
        {
          id: 4011,
          name: "Black / M",
          price: 12.95,
        },
      ],
    },
  ],
};

const PRINTFUL_PRICES_FIXTURE = {
  data: {
    variant_id: 4011,
    price: 12.95,
    currency: "USD",
  },
};

const PRINTFUL_MOCKUP_CREATE_FIXTURE = {
  data: [
    {
      id: 597350033,
      status: "pending",
    },
  ],
};

const PRINTFUL_MOCKUP_GET_FIXTURE = {
  id: 597350033,
  status: "completed",
  catalog_variant_mockups: [
    {
      catalog_variant_id: 4011,
      mockups: [
        {
          placement: "front",
          display_name: "Front Print",
          technique: "dtg",
          style_id: 1,
          mockup_url: "https://example.com/mockup.png",
        },
      ],
    },
  ],
  failure_reasons: [],
};

const PRINTFUL_STORE_PRODUCT_FIXTURE = {
  result: {
    id: 7001,
    external_id: "commercebench-graphic-tshirts-4011",
    name: "Graphic T-Shirts launch draft",
    variants: 1,
    synced: 1,
    thumbnail_url: "https://example.com/mockup.png",
  },
};

const CJ_GET_ACCESS_TOKEN_FIXTURE = {
  data: {
    openId: 123456789,
    accessToken: "cj-access-token",
    accessTokenExpiryDate: "2026-05-11T09:16:33+08:00",
    refreshToken: "cj-refresh-token",
    refreshTokenExpiryDate: "2026-10-23T09:16:33+08:00",
    createDate: "2026-04-26T09:16:33+08:00",
  },
};

const CJ_REFRESH_ACCESS_TOKEN_FIXTURE = {
  data: {
    accessToken: "cj-access-token-refreshed",
    accessTokenExpiryDate: "2026-05-12T09:16:33+08:00",
    refreshToken: "cj-refresh-token-refreshed",
    refreshTokenExpiryDate: "2026-10-24T09:16:33+08:00",
    createDate: "2026-04-27T09:16:33+08:00",
  },
};

const CJ_BALANCE_FIXTURE = {
  data: {
    balance: 125.5,
  },
};

const CJ_CREATE_ORDER_DRAFT_FIXTURE = {
  data: {
    orderId: "CJ-ORDER-001",
    orderNumber: "TT-ORDER-001",
    shipmentOrderId: "SHIP-001",
    actualPayment: "0.00",
    orderAmount: "8.75",
    cjPayUrl: "https://cjdropshipping.com/pay/order/CJ-ORDER-001",
    orderStatus: "CREATED",
    logisticsMiss: false,
    productInfoList: [
      {
        storeLineItemId: "line-1",
        lineItemId: "cj-line-1",
        variantId: "cj-variant-1",
        quantity: 2,
        isGroup: false,
      },
    ],
    interceptOrderReasons: [],
  },
};

const CJ_ORDER_LIST_FIXTURE = {
  data: {
    pageNum: 1,
    pageSize: 20,
    total: 1,
    list: [
      {
        orderId: "CJ-ORDER-001",
        orderNumber: "TT-A1B2C3D4E5F6",
        shipmentOrderId: "SHIP-001",
        orderStatus: "UNPAID",
        shippingCountryCode: "US",
        shippingProvince: "California",
        shippingCity: "Los Angeles",
        shippingCustomerName: "Jane Doe",
        orderAmount: "8.75",
        actualPayment: "0.00",
        logisticName: "CJPacket Ordinary",
        trackNumber: "TRACK-123",
        createDate: "2026-04-26 00:00:00",
      },
    ],
  },
};

const CJ_ORDER_DETAIL_FIXTURE = {
  data: {
    orderId: "CJ-ORDER-001",
    orderNumber: "TT-A1B2C3D4E5F6",
    shipmentOrderId: "SHIP-001",
    orderStatus: "UNPAID",
    shippingCountryCode: "US",
    shippingProvince: "California",
    shippingCity: "Los Angeles",
    shippingCustomerName: "Jane Doe",
    shippingAddress: "123 Sunset Blvd",
    shippingZip: "90001",
    actualPayment: "0.00",
    orderAmount: "8.75",
    logisticName: "CJPacket Ordinary",
    trackNumber: "TRACK-123",
    createDate: "2026-04-26 00:00:00",
    paymentDate: null,
    productList: [
      {
        lineItemId: "cj-line-1",
        variantId: "cj-variant-1",
        quantity: 2,
        sku: "CJ-HAIR-001",
        productName: "Heatless Hair Curler Set",
      },
    ],
  },
};

const TIKTOK_ACCESS_TOKEN_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    access_token: "tts-access-token",
    refresh_token: "tts-refresh-token",
    access_token_expire_in: 604800,
    refresh_token_expire_in: 5184000,
    open_id: "open-123",
    seller_name: "useorune",
  },
};

const TIKTOK_REFRESH_TOKEN_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    access_token: "tts-access-token-refreshed",
    refresh_token: "tts-refresh-token-refreshed",
    access_token_expire_in: 604800,
    refresh_token_expire_in: 5184000,
    open_id: "open-123",
    seller_name: "useorune",
  },
};

const TIKTOK_AUTHORIZED_SHOPS_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    shops: [
      {
        id: "shop-123",
        cipher: "cipher-123",
        code: "US",
        name: "UseOrRune US",
        region: "US",
        seller_type: "LOCAL",
      },
    ],
  },
};

const TIKTOK_SEARCH_PRODUCTS_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    total_count: 1,
    next_page_token: "",
    products: [
      {
        id: "tts-prod-1",
        title: "Hydrocolloid Pimple Patches",
        status: "DRAFT",
        skus: [{ id: "sku-1" }],
        sales_regions: ["US"],
        listing_quality_tier: "GOOD",
        audit: { status: "AUDITING" },
      },
    ],
  },
};

const TIKTOK_SEARCH_ORDERS_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    next_page_token: "",
    orders: [
      {
        id: "tts-order-1",
        status: "AWAITING_SHIPMENT",
        create_time: 1714089600,
        update_time: 1714093200,
        buyer_email: "buyer@example.com",
        recipient_address: {
          full_address: "123 Main St, Los Angeles, CA 90001",
        },
        payment: {
          currency: "USD",
          total_amount: "14.99",
        },
        line_items: [{ id: "line-1" }],
      },
    ],
  },
};

const TIKTOK_WAREHOUSES_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    warehouses: [
      {
        id: "wh-1",
        is_default: true,
        name: "Main Warehouse",
        effect_status: "ENABLED",
        address: {
          region_code: "US",
          city: "Los Angeles",
        },
      },
    ],
  },
};

const TIKTOK_CATEGORY_RECOMMEND_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    leaf_category_id: "cat-1",
    categories: [
      { id: "beauty", name: "Beauty", level: 1, is_leaf: false, permission_statuses: [] },
      { id: "cat-1", name: "Hair Styling Tools", level: 2, is_leaf: true, permission_statuses: [] },
    ],
  },
};

const TIKTOK_UPLOAD_IMAGE_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    uri: "img-uri-1",
    url: "https://cdn.example.com/img.jpg",
    width: 1200,
    height: 1200,
    use_case: "MAIN_IMAGE",
  },
};

const TIKTOK_CREATE_PRODUCT_FIXTURE = {
  code: 0,
  message: "success",
  data: {
    product_id: "tts-prod-created-1",
    skus: [
      {
        id: "tts-sku-created-1",
        seller_sku: "CJ-HAIR-001",
      },
    ],
    warnings: [],
  },
};

const CJ_PRODUCTS_FIXTURE = {
  products: [
    {
      product_id: "cj-123",
      name: "Heatless Hair Curler Set",
      sku: "CJ-HAIR-001",
      price: 6.5,
    },
  ],
};

const FIXTURE_HTML = `
  <main>
    <article>
      <a href="https://www.tiktok.com/@kitchenfinds">@kitchenfinds</a>
      <span>Kitchen Finds</span>
      <span>128K followers</span>
      <span>kitchen</span>
    </article>
    <article>
      <a href="https://www.tiktok.com/@beautydropsdaily">@beautydropsdaily</a>
      <span>Beauty Drops Daily</span>
      <span>245K followers</span>
      <span>beauty</span>
    </article>
  </main>
`;

async function main(): Promise<void> {
  const registry = createDefaultToolRegistry();
  const traceRoot = await mkdtemp(path.join(os.tmpdir(), "commercebench-tools-"));
  const trace = new FileResearchTrace(traceRoot, new Date("2026-04-26T00:00:00.000Z"));
  await trace.initialize({
    command: "agent:tools:test",
  });

  const executor = new ToolExecutor(registry, trace);
  const fetchResult = await executor.execute(
    "fetch_web_page",
    {
      url: "https://example.com/research-fixture",
      maxCharacters: 200,
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: async () =>
        new Response(FETCH_FIXTURE_HTML, {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        }),
    },
  );

  const productCreationFetch: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url === "https://example.com/product.jpg") {
      return new Response("image-bytes", { status: 200 });
    }

    if (url.includes("/authentication/getAccessToken")) {
      return new Response(JSON.stringify(CJ_GET_ACCESS_TOKEN_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/authentication/refreshAccessToken")) {
      return new Response(JSON.stringify(CJ_REFRESH_ACCESS_TOKEN_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/shopping/pay/getBalance")) {
      return new Response(JSON.stringify(CJ_BALANCE_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/shopping/order/createOrderV2")) {
      return new Response(JSON.stringify(CJ_CREATE_ORDER_DRAFT_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/shopping/order/list")) {
      return new Response(JSON.stringify(CJ_ORDER_LIST_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/shopping/order/getOrderDetail")) {
      return new Response(JSON.stringify(CJ_ORDER_DETAIL_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.startsWith("https://auth.tiktok-shops.com")) {
      return new Response(JSON.stringify(
        url.includes("refresh_token") ? TIKTOK_REFRESH_TOKEN_FIXTURE : TIKTOK_ACCESS_TOKEN_FIXTURE,
      ), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/authorization/202309/shops")) {
      return new Response(JSON.stringify(TIKTOK_AUTHORIZED_SHOPS_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/logistics/202309/warehouses")) {
      return new Response(JSON.stringify(TIKTOK_WAREHOUSES_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/product/202309/categories/recommend")) {
      return new Response(JSON.stringify(TIKTOK_CATEGORY_RECOMMEND_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/product/202309/images/upload")) {
      return new Response(JSON.stringify(TIKTOK_UPLOAD_IMAGE_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/product/202309/products/activate") || url.includes("/product/202309/products/deactivate")) {
      return new Response(JSON.stringify({ code: 0, message: "success", data: {} }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/product/202309/products/delete")) {
      return new Response(JSON.stringify({ code: 0, message: "success", data: {} }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/product/202309/products")) {
      return new Response(JSON.stringify(TIKTOK_CREATE_PRODUCT_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/product/202502/products/search")) {
      return new Response(JSON.stringify(TIKTOK_SEARCH_PRODUCTS_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/order/202309/orders/search")) {
      return new Response(JSON.stringify(TIKTOK_SEARCH_ORDERS_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/v2/mockup-tasks") && url.includes("id=")) {
      return new Response(JSON.stringify(PRINTFUL_MOCKUP_GET_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/v2/mockup-tasks")) {
      return new Response(JSON.stringify(PRINTFUL_MOCKUP_CREATE_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/store/products")) {
      return new Response(JSON.stringify(PRINTFUL_STORE_PRODUCT_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/api2.0/v1/product/query")) {
      return new Response(JSON.stringify(CJ_PRODUCTS_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/products")) {
      return new Response(JSON.stringify(PRINTFUL_PRODUCTS_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    if (url.includes("/prices")) {
      return new Response(JSON.stringify(PRINTFUL_PRICES_FIXTURE), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    throw new Error(`Unexpected product creation fetch URL: ${url}`);
  };

  const printfulProducts = await executor.execute(
    "get_printful_products",
    {
      categoryId: 24,
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const printfulPrice = await executor.execute(
    "get_printful_variant_prices",
    {
      variantId: 4011,
      storeId: "store-123",
      currency: "USD",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const mockupTask = await executor.execute(
    "create_printful_mockup_task",
    {
      storeId: "store-123",
      catalogProductId: 71,
      catalogVariantIds: [4011],
      mockupStyleIds: [100],
      placements: [
        {
          placement: "front",
          technique: "dtg",
          printAreaType: "simple",
          imageUrl: "https://example.com/design.png",
          position: {
            width: 10,
            height: 10,
            top: 0,
            left: 0,
          },
        },
      ],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const mockupTaskResult = await executor.execute(
    "get_printful_mockup_task",
    {
      taskId: 597350033,
      storeId: "store-123",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const cjAccessToken = await executor.execute(
    "get_cj_access_token",
    {
      apiKey: "CJUSER@api@test-key",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const cjRefreshedToken = await executor.execute(
    "refresh_cj_access_token",
    {
      refreshToken: "cj-refresh-token",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const cjBalance = await executor.execute(
    "get_cj_balance",
    {
      accessToken: "cj-access-token",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const cjOrderDraft = await executor.execute(
    "create_cj_order_draft",
    {
      accessToken: "cj-access-token",
      orderNumber: "TT-ORDER-001",
      shippingCountryCode: "US",
      shippingCountry: "United States",
      shippingProvince: "California",
      shippingCity: "Los Angeles",
      shippingCustomerName: "Jane Doe",
      shippingAddress: "123 Sunset Blvd",
      logisticName: "CJPacket Ordinary",
      fromCountryCode: "CN",
      products: [
        {
          vid: "cj-variant-1",
          quantity: 2,
          storeLineItemId: "line-1",
        },
      ],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const tiktokAccessToken = await executor.execute(
    "get_tiktok_access_token",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      authCode: "auth-code",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const tiktokRefreshedToken = await executor.execute(
    "refresh_tiktok_access_token",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      refreshToken: "tts-refresh-token",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const tiktokAuthorizedShops = await executor.execute(
    "get_tiktok_authorized_shops",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const tiktokProducts = await executor.execute(
    "search_tiktok_products",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
      status: "DRAFT",
      pageSize: 10,
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const tiktokOrders = await executor.execute(
    "search_tiktok_orders",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
      orderStatus: "AWAITING_SHIPMENT",
      pageSize: 10,
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const storeProduct = await executor.execute(
    "create_printful_store_product",
    {
      storeId: "store-123",
      externalProductId: "commercebench-graphic-tshirts-4011",
      externalVariantId: "commercebench-graphic-tshirts-4011-variant",
      name: "Graphic T-Shirts launch draft",
      variantId: 4011,
      retailPrice: 29.99,
      artworkUrl: "https://example.com/design.png",
      thumbnailUrl: "https://example.com/mockup.png",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const cjProducts = await executor.execute(
    "query_cj_products",
    {
      accessToken: "cj-token",
      name: "Heatless Hair Curlers beauty hair personalcare heatless",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const cjOrders = await executor.execute(
    "get_cj_orders",
    {
      accessToken: "cj-access-token",
      status: "UNPAID",
      pageNum: 1,
      pageSize: 20,
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const cjOrderDetail = await executor.execute(
    "get_cj_order_detail",
    {
      accessToken: "cj-access-token",
      orderId: "CJ-ORDER-001",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const affiliateResult = await executor.execute(
    "get_tiktok_affiliate",
    {
      query: "beauty creators with affiliate momentum",
      html: FIXTURE_HTML,
      pageUrl: "https://affiliate-us.tiktok.com/connection/creator",
      limit: 5,
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
    },
  );

  const tiktokWarehouses = await executor.execute(
    "get_tiktok_warehouses",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const tiktokCategory = await executor.execute(
    "recommend_tiktok_category",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
      title: "Heatless Hair Curler Set",
      description: "TikTok beauty product",
      imageUrls: ["https://example.com/product.jpg"],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const tiktokUploadImage = await executor.execute(
    "upload_tiktok_product_image",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
      imageUrl: "https://example.com/product.jpg",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const tiktokCreateProduct = await executor.execute(
    "create_tiktok_product",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
      title: "Heatless Hair Curler Set",
      description: "TikTok beauty product",
      categoryId: "cat-1",
      mainImageUris: ["img-uri-1"],
      skus: [
        {
          sellerSku: "CJ-HAIR-001",
          priceAmount: "19.99",
          currency: "USD",
          warehouseId: "wh-1",
          quantity: 25,
        },
      ],
      packageWeightValue: "0.3",
      packageWeightUnit: "KILOGRAM",
      packageLength: "20",
      packageWidth: "15",
      packageHeight: "5",
      packageDimensionUnit: "CENTIMETER",
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const activatedProducts = await executor.execute(
    "activate_tiktok_products",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
      productIds: ["tts-prod-created-1"],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const deactivatedProducts = await executor.execute(
    "deactivate_tiktok_products",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
      productIds: ["tts-prod-created-1"],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const deletedProducts = await executor.execute(
    "delete_tiktok_products",
    {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tts-access-token",
      shopCipher: "cipher-123",
      productIds: ["tts-prod-created-1"],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: productCreationFetch,
    },
  );

  const previousRemoteShellMode = process.env.AGENT_REMOTE_SHELL_MODE;
  try {
    process.env.AGENT_REMOTE_SHELL_MODE = "local";
    const remoteShellResult = await executeRemoteShellCommand(
      {
        command: "printf agent-shell-ok",
      },
      new Date("2026-04-26T00:00:00.000Z"),
    );

    assert.equal(remoteShellResult.stdout, "agent-shell-ok");
    assert.equal(remoteShellResult.mode, "local");
  } finally {
    if (previousRemoteShellMode === undefined) {
      delete process.env.AGENT_REMOTE_SHELL_MODE;
    } else {
      process.env.AGENT_REMOTE_SHELL_MODE = previousRemoteShellMode;
    }
  }

  assert.equal(registry.listTools().length, 27);
  assert.equal(registry.listToolsForStage("research").length, 1);
  assert.equal(registry.listToolsForStage("product_creation").length, 10);
  assert.equal(registry.listToolsForStage("listing").length, 9);
  assert.equal(registry.listToolsForStage("monitoring").length, 4);
  assert.equal(registry.listToolsForStage("pivoting").length, 2);
  assert.equal(fetchResult.title, "Research Fixture");
  assert.equal(fetchResult.text.includes("Current page text"), true);
  assert.equal(printfulProducts.products[0]?.name, "Unisex Staple T-Shirt");
  assert.equal(printfulProducts.products[0]?.variants[0]?.id, 4011);
  assert.equal(printfulPrice.price, 12.95);
  assert.equal(mockupTask.taskId, 597350033);
  assert.equal(cjAccessToken.accessToken, "cj-access-token");
  assert.equal(cjRefreshedToken.accessToken, "cj-access-token-refreshed");
  assert.equal(cjBalance.balance, 125.5);
  assert.equal(cjOrderDraft.orderId, "CJ-ORDER-001");
  assert.equal(cjOrderDraft.actualPayment, 0);
  assert.equal(cjOrders.orders[0]?.orderId, "CJ-ORDER-001");
  assert.equal(cjOrderDetail.trackNumber, "TRACK-123");
  assert.equal(tiktokAccessToken.accessToken, "tts-access-token");
  assert.equal(tiktokRefreshedToken.accessToken, "tts-access-token-refreshed");
  assert.equal(tiktokAuthorizedShops.shops[0]?.cipher, "cipher-123");
  assert.equal(tiktokProducts.products[0]?.title, "Hydrocolloid Pimple Patches");
  assert.equal(tiktokOrders.orders[0]?.id, "tts-order-1");
  assert.equal(tiktokOrders.orders[0]?.status, "AWAITING_SHIPMENT");
  assert.equal(tiktokWarehouses.warehouses[0]?.id, "wh-1");
  assert.equal(tiktokCategory.categoryId, "cat-1");
  assert.equal(tiktokUploadImage.uri, "img-uri-1");
  assert.equal(tiktokCreateProduct.productId, "tts-prod-created-1");
  assert.equal(activatedProducts.productIds[0], "tts-prod-created-1");
  assert.equal(deactivatedProducts.productIds[0], "tts-prod-created-1");
  assert.equal(deletedProducts.productIds[0], "tts-prod-created-1");
  assert.equal(mockupTaskResult.assets[0]?.mockupUrl, "https://example.com/mockup.png");
  assert.equal(storeProduct.productId, 7001);
  assert.equal(cjProducts.products[0]?.productId, "cj-123");
  assert.equal(affiliateResult.affiliates.length, 2);
  assert.equal(affiliateResult.affiliates[0]?.handle, "@kitchenfinds");
  assert.equal(affiliateResult.affiliates[1]?.category, "beauty");

  const toolInputPath = path.join(
    trace.traceDirectory,
    "tools",
    `${trace.queryBaseName("fetch_web_page-2026-04-26T00:00:00.000Z")}-input.json`,
  );
  const toolOutputPath = path.join(
    trace.traceDirectory,
    "tools",
    `${trace.queryBaseName("get_tiktok_affiliate-2026-04-26T00:00:00.000Z")}-output.json`,
  );

  const toolInput = JSON.parse(await readFile(toolInputPath, "utf8")) as { tool: string };
  const toolOutput = JSON.parse(await readFile(toolOutputPath, "utf8")) as { affiliates: Array<{ handle: string }> };

  assert.equal(toolInput.tool, "fetch_web_page");
  assert.equal(toolOutput.affiliates[0]?.handle, "@kitchenfinds");

  console.log("Tool smoke test passed.");
  console.log(`Registered tools: ${registry.listTools().map((entry) => entry.name).join(", ")}`);
  console.log(`Trace directory: ${trace.traceDirectory}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});