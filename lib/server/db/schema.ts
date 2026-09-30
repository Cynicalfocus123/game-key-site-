import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

// Better Auth core tables + CoreCart user fields.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // customer | seller | admin | master_admin (T2). Marketplace seller onboarding comes later.
  role: text("role").notNull().default("customer"),
  // T2: admin sections (lib/admin-perms.ts ids). Checked on every admin API call. null = all sections; master_admin ignores it.
  adminPerms: jsonb("admin_perms").$type<string[]>(),
  // T3 close account: data is never deleted. closed = sign-in blocked, sessions revoked. closed_email = the address when it was closed
  // (a new sign-up with that address gets a placeholder email + claim_email; only after it verifies does one transaction move the
  // address from the closed row to the new account, which admins see as a returning person).
  status: text("status").notNull().default("active"), // active | closed
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedBy: text("closed_by"), // user id: the person themselves or an admin
  closedReason: text("closed_reason"),
  closedEmail: text("closed_email"),
  claimEmail: text("claim_email"), // R1: real address of a sign-up that reuses a closed account's email (email = claim+…@claim.invalid until verified)
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  termsVersion: text("terms_version"), // R7: Terms version the person explicitly accepted (null = no server proof, e.g. accounts made before R7)
  marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  currency: text("currency"), // chosen display currency (null = auto-pick)
  avatar: text("avatar"), // preset colour id (lib/profile.ts AVATARS), null = none
  country: text("country"), // ISO 3166 alpha-2 from lib/currency/currencies.ts COUNTRY_CODES
  marketingChoiceAt: timestamp("marketing_choice_at", { withTimezone: true }), // when the user last chose yes/no on deal emails
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// Our own fixed-window limits (gift cards, promo codes, tickets; lib/server/rate-limit.ts). Separate from Better Auth rate_limit:
// Better Auth deletes every rate_limit row older than its own ~60 s window, which wiped these counters.
export const appRateLimit = pgTable("app_rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: bigint("window_start", { mode: "number" }).notNull(), // ms
});

// Orders. Checkout (Step 5) will create these; for now only dev sample orders.
export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"), // pending | paid | completed | refunded | cancelled
  currency: text("currency").notNull().default("USD"), // currency charged
  totalCents: integer("total_cents").notNull(), // amount charged, minor units of `currency`
  baseCurrency: text("base_currency").notNull().default("THB"),
  baseTotalMinor: integer("base_total_minor"), // same total in THB satang
  fxRate: numeric("fx_rate", { precision: 24, scale: 12 }), // units of `currency` per 1 THB used for this order
  ratesAt: timestamp("rates_at", { withTimezone: true }), // when that rate was fetched
  isSample: boolean("is_sample").notNull().default(false),
  // Email task (2026-09-29): order page + receipt. Minor units of `currency`. tax_info = customer's optional tax details (lib/orders.ts TaxInfo).
  paymentMethod: text("payment_method"), // card | wallet | paypal | … (lib/orders.ts PAYMENT_LABEL)
  paymentLast4: text("payment_last4"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  subtotalMinor: integer("subtotal_minor"),
  discountMinor: integer("discount_minor").notNull().default(0),
  promoCode: text("promo_code"),
  walletMinor: integer("wallet_minor").notNull().default(0),
  taxInfo: jsonb("tax_info"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("orders_user_idx").on(t.userId), index("orders_paid_idx").on(t.paidAt)]); // paid_idx: purchase popup feed (last 24 h)

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // game_key | hardware
  platform: text("platform"),
  region: text("region"),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(),
  productId: text("product_id"), // catalog id when known (cover + link)
  seller: text("seller").notNull().default("CoreCart"), // seller name shown on the order (marketplace sellers later)
}, (t) => [index("order_items_order_idx").on(t.orderId)]);

// One row per successful sign-in. Kept after sign-out so admins see login history.
export const loginEvent = pgTable("login_event", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  method: text("method").notNull(), // email | google | email-verify
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  location: text("location"), // approximate place from the IP (lib/server/geo.ts), null when unknown
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("login_event_user_idx").on(t.userId), index("login_event_created_idx").on(t.createdAt)]);

// Currencies: 53 seeded on first use. Rates are units per 1 USD (ExchangeRate-API). override_rate wins over auto_rate.
export const currency = pgTable("currency", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  decimals: integer("decimals").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  chargeable: boolean("chargeable").notNull().default(false),
  autoRate: numeric("auto_rate", { precision: 24, scale: 12 }),
  overrideRate: numeric("override_rate", { precision: 24, scale: 12 }),
  roundStep: integer("round_step").notNull().default(1), // minor units, 1 = no extra rounding
  rateUpdatedAt: timestamp("rate_updated_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per rate source: last fetch attempt, last success, last error.
export const rateStatus = pgTable("rate_status", {
  id: text("id").primaryKey(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  providerUpdatedAt: timestamp("provider_updated_at", { withTimezone: true }),
  lastError: text("last_error"),
});

// Signed-in cart: one row per product. product_id = lib/catalog.ts id until the catalog DB exists. Guest carts stay in the browser.
export const cartItem = pgTable("cart_item", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]);

// Game keys: one row per key unit of a game_key order line. revealed_at set on first reveal (ends the refund window).
export const orderKey = pgTable("order_key", {
  id: text("id").primaryKey(),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  revealedAt: timestamp("revealed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("order_key_user_idx").on(t.userId), index("order_key_item_idx").on(t.orderItemId)]);

// Reveal audit: every time the code is shown (who, when, IP, browser).
export const keyReveal = pgTable("key_reveal", {
  id: text("id").primaryKey(),
  keyId: text("key_id").notNull().references(() => orderKey.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("key_reveal_key_idx").on(t.keyId)]);

// Favorites (♡): one row per saved product. product_id = lib/catalog.ts id until the catalog DB exists. Guest favorites stay in the browser.
export const favorite = pgTable("favorite", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]);

// Gift cards (admin-issued). Only the SHA-256 hash + last 4 are stored; the full code is shown once at creation. Single use, full amount.
export const giftCard = pgTable("gift_card", {
  id: text("id").primaryKey(),
  codeHash: text("code_hash").notNull().unique(),
  last4: text("last4").notNull(),
  amountMinor: integer("amount_minor").notNull(), // THB satang
  note: text("note"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  disabled: boolean("disabled").notNull().default(false),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  redeemedBy: text("redeemed_by").references(() => user.id, { onDelete: "set null" }),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }),
}, (t) => [index("gift_card_created_idx").on(t.createdAt)]);

// Balance ledger: one signed row per money movement. Balance = sum per bucket (wallet | gift). Rows are never edited or deleted.
export const walletLedger = pgTable("wallet_ledger", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  bucket: text("bucket").notNull(), // wallet | gift
  type: text("type").notNull(), // gift_card_redeem | adjustment (S8 admin) | top_up (T1; later: purchase, top_up_refund)
  amountMinor: integer("amount_minor").notNull(), // THB satang, + credit / - debit
  ref: text("ref").notNull(), // shown to the customer, e.g. gift card ••••-••••-••••-AB12
  giftCardId: text("gift_card_id").references(() => giftCard.id, { onDelete: "set null" }),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }), // admin who made an adjustment (audit)
  // T1: the top-up this row credits. Unique = one top-up can never credit the wallet twice (last guard after event id + row lock).
  topUpId: text("top_up_id").references(() => topUp.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("wallet_ledger_user_idx").on(t.userId), uniqueIndex("wallet_ledger_top_up_idx").on(t.topUpId)]);

// Promo codes (admin). Money columns are THB satang. deleted_at = soft delete once redeemed by real orders (hard delete while uses = 0).
export const promoCode = pgTable("promo_code", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(), // upper case, A-Z 0-9 -, 3-32
  type: text("type").notNull(), // percent | fixed
  value: integer("value").notNull(), // percent 1-100, or THB satang
  maxDiscount: integer("max_discount"), // percent only
  appliesTo: text("applies_to").notNull().default("all"), // all | categories
  categories: text("categories").array().notNull().default(sql`'{}'::text[]`),
  minSubtotal: integer("min_subtotal"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  maxUses: integer("max_uses"),
  oncePerCustomer: boolean("once_per_customer").notNull().default(false),
  uses: integer("uses").notNull().default(0), // counted by real checkout (promo_redemption comes with payments)
  enabled: boolean("enabled").notNull().default(true),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Return requests (Returns & Orders): one order line + quantity. Status requested → approved | rejected → refunded (manual note until payments).
export const returnRequest = pgTable("return_request", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(), // RT-XXXXXXXX
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  orderItemId: text("order_item_id").notNull().references(() => orderItems.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  reason: text("reason").notNull(), // lib/returns.ts ReturnReason
  message: text("message").notNull().default(""),
  status: text("status").notNull().default("requested"), // requested | approved | rejected | refunded
  adminNote: text("admin_note"),
  handledBy: text("handled_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("return_request_user_idx").on(t.userId), index("return_request_item_idx").on(t.orderItemId)]);

// Support tickets (C9–C11). number = shown as #1001. customer_unread = support replied and the customer has not opened the thread yet.
export const ticket = pgTable("ticket", {
  id: text("id").primaryKey(),
  number: integer("number").notNull().unique().generatedAlwaysAsIdentity({ startWith: 1001 }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // lib/tickets.ts TicketCategory
  subject: text("subject").notNull(),
  status: text("status").notNull().default("open"), // open | answered | closed
  orderId: text("order_id").references(() => orders.id, { onDelete: "set null" }),
  orderRef: text("order_ref"), // order number as typed by the customer (upper-case); order_id is set when it matches one of their orders
  keyId: text("key_id").references(() => orderKey.id, { onDelete: "set null" }),
  customerUnread: boolean("customer_unread").notNull().default(false),
  lastReplyAt: timestamp("last_reply_at", { withTimezone: true }).notNull().defaultNow(),
  lastReplyBy: text("last_reply_by").notNull().default("customer"), // customer | support
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ticket_user_idx").on(t.userId), index("ticket_last_reply_idx").on(t.lastReplyAt)]);

export const ticketMessage = pgTable("ticket_message", {
  id: text("id").primaryKey(),
  ticketId: text("ticket_id").notNull().references(() => ticket.id, { onDelete: "cascade" }),
  authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
  fromSupport: boolean("from_support").notNull().default(false),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("ticket_message_ticket_idx").on(t.ticketId)]);

// Admin actions on a user (future task S7): account created by an admin, role changes. Never edited.
export const userAudit = pgTable("user_audit", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  adminId: text("admin_id").references(() => user.id, { onDelete: "set null" }),
  action: text("action").notNull(), // created | role | perms (T2, detail = "before → after") | topup_failed | topup_cancelled (T1, detail = "TU-… · reason")
  detail: text("detail").notNull(), // e.g. "customer → seller"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("user_audit_user_idx").on(t.userId)]);

// Admin filter manager (future task S4, lib/filters.ts). id = FilterGroupId (genre, platform, region, type, os, country, sale, price).
export const filterGroup = pgTable("filter_group", {
  id: text("id").primaryKey(),
  shown: boolean("shown").notNull().default(true),
  startOpen: boolean("start_open").notNull().default(true),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
// One row per filter value. value = catalog value (URL id), label = admin name. deleted_at = soft delete (keeps the catalog merge from adding it back).
export const filterOption = pgTable("filter_option", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  value: text("value").notNull(),
  label: text("label").notNull(),
  hidden: boolean("hidden").notNull().default(false),
  position: integer("position").notNull().default(0),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("filter_option_group_value_idx").on(t.groupId, t.value)]);

// Store menu (task D): header bar, products drawer, footer "Shop" column. parent_id = one level of sub-items. deleted_at = soft delete
// (the default menu is copied in only while the table is empty, so deleted items stay deleted).
export const menuItem = pgTable("menu_item", {
  id: text("id").primaryKey(),
  parentId: text("parent_id"),
  label: text("label").notNull(),
  href: text("href").notNull(),
  kind: text("kind").notNull().default("link"), // link | genres | under
  position: integer("position").notNull().default(0),
  hidden: boolean("hidden").notNull().default(false),
  isNew: boolean("is_new").notNull().default(false),
  inBar: boolean("in_bar").notNull().default(false),
  inFooter: boolean("in_footer").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Wallet top-ups (future task T1, lib/topup.ts). amount_minor + currency = charged; credit_minor = THB satang added on success
// (fx_rate = units of currency per 1 THB, saved at creation). Only a verified provider webhook moves a row to paid / credited.
export const topUp = pgTable("top_up", {
  id: text("id").primaryKey(),
  number: text("number").notNull().unique(), // TU-12345678, shown to the customer and used as the ledger ref
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
  creditMinor: integer("credit_minor").notNull(),
  fxRate: numeric("fx_rate", { precision: 24, scale: 12 }).notNull(),
  status: text("status").notNull().default("pending"), // pending → paid → credited | failed | expired | cancelled
  provider: text("provider").notNull(), // dev | stripe | omise | 2c2p ("none" never creates rows)
  providerRef: text("provider_ref"), // payment id at the provider
  idempotencyKey: text("idempotency_key").notNull(), // from the browser: a double click returns the same top-up
  failureReason: text("failure_reason"),
  reviewNote: text("review_note"), // R8, admin only: a verified provider event that did not match (money may be taken, nothing credited)
  closedBy: text("closed_by").references(() => user.id, { onDelete: "set null" }), // admin who marked failed / cancelled
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // pending deadline (created + 30 min)
  paidAt: timestamp("paid_at", { withTimezone: true }),
  creditedAt: timestamp("credited_at", { withTimezone: true }),
  closedAt: timestamp("closed_at", { withTimezone: true }), // when it became failed / expired / cancelled
}, (t) => [uniqueIndex("top_up_user_key_idx").on(t.userId, t.idempotencyKey), index("top_up_user_idx").on(t.userId, t.createdAt), index("top_up_status_idx").on(t.status, t.expiresAt),
  index("top_up_provider_ref_idx").on(t.provider, t.providerRef)]);

// Raw payment webhook log (T1). One row per verified provider event; unique (provider, event_id) = a repeated event is ignored.
export const paymentEvent = pgTable("payment_event", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  eventId: text("event_id").notNull(),
  type: text("type").notNull(),
  topUpId: text("top_up_id").references(() => topUp.id, { onDelete: "set null" }),
  payload: text("payload").notNull(), // raw body as received (max 64 KB)
  result: text("result").notNull().default("received"), // credited | failed | ignored: … | error: …
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (t) => [uniqueIndex("payment_event_provider_event_idx").on(t.provider, t.eventId), index("payment_event_top_up_idx").on(t.topUpId)]);

// Product catalog (task B, 2026-09-29). Seeded once from lib/catalog.ts; edited in /admin/products. Deleting = status "deleted"
// (the id stays reserved: carts, favorites and order history point at it). Prices are THB satang. `data` = the full lib/catalog.ts Product
// (description, requirements, region rule, genres …); the columns next to it are copies used for sorting / filtering in SQL.
export const product = pgTable("product", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // game_key | hardware
  status: text("status").notNull().default("published"), // published | draft | deleted
  price: integer("price").notNull(),
  data: jsonb("data").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("product_status_idx").on(t.status, t.kind)]);

// Product images (task B): the cropped 800 x 1000 WebP / JPEG, base64. Served by /api/images/{id} (cached for a year: a new upload = a new id).
export const productImage = pgTable("product_image", {
  id: text("id").primaryKey(),
  mime: text("mime").notNull(),
  bytes: integer("bytes").notNull(),
  data: text("data").notNull(),
  uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Game key inventory (task B). code_enc = AES-256-GCM (iv.tag.data, base64) with KEY_ENCRYPTION_KEY; code_hash = HMAC for "already added"
// checks (unique per product); last4 = shown in admin. status: available → reserved (checkout, later) → sold.
export const productKey = pgTable("product_key", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull().references(() => product.id, { onDelete: "cascade" }),
  codeEnc: text("code_enc").notNull(),
  codeHash: text("code_hash").notNull(),
  last4: text("last4").notNull(),
  status: text("status").notNull().default("available"),
  batch: text("batch"),
  addedBy: text("added_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  soldAt: timestamp("sold_at", { withTimezone: true }),
}, (t) => [uniqueIndex("product_key_hash_idx").on(t.productId, t.codeHash), index("product_key_status_idx").on(t.productId, t.status)]);

// T3 seller applications. One row per application (a rejected applicant may apply again: new row). Never deleted.
// id_number: AES-256-GCM (KEY_ENCRYPTION_KEY) + HMAC hash for returning-person matching; merchant_key = lower-case letters + digits only.
export const sellerApplication = pgTable("seller_application", {
  id: text("id").primaryKey(),
  seq: integer("seq").notNull().unique().generatedAlwaysAsIdentity({ startWith: 1 }), // shown as SA-100001
  userId: text("user_id").notNull().references(() => user.id),
  email: text("email").notNull(), // the account email when applying
  status: text("status").notNull().default("pending"), // pending | approved | rejected | blacklisted
  data: jsonb("data").$type<Record<string, unknown>>().notNull(), // personal, stock, company answers (lib/sellers.ts SellerInput without files / ID number)
  merchantName: text("merchant_name").notNull(),
  merchantKey: text("merchant_key").notNull(),
  idType: text("id_type").notNull(),
  idNumberEnc: text("id_number_enc").notNull(),
  idNumberHash: text("id_number_hash").notNull(),
  idLast4: text("id_last4").notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decidedBy: text("decided_by").references(() => user.id, { onDelete: "set null" }),
  reason: text("reason"), // reject reason (the applicant sees it)
  blacklistReason: text("blacklist_reason"), // admin only
  statusBefore: text("status_before"), // status before a blacklist (restored when removed from the blacklist)
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("seller_app_user_idx").on(t.userId, t.createdAt), index("seller_app_status_idx").on(t.status, t.createdAt), index("seller_app_merchant_idx").on(t.merchantKey),
  uniqueIndex("seller_app_merchant_open_idx").on(t.merchantKey).where(sql`${t.status} in ('pending', 'approved')`), // R3: one open application per merchant name
  index("seller_app_idnum_idx").on(t.idNumberHash), index("seller_app_email_idx").on(t.email)]);
// Uploaded files (encrypted on disk in .data/uploads/seller/<stored_name>). application_id stays null until the application is sent.
export const sellerFile = pgTable("seller_file", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id),
  applicationId: text("application_id").references(() => sellerApplication.id),
  kind: text("kind").notNull(), // invoice | key | id_front | id_back | selfie
  mime: text("mime").notNull(), // from the file content, never the name
  size: integer("size").notNull(),
  sha256: text("sha256").notNull(),
  storedName: text("stored_name").notNull().unique(),
  originalName: text("original_name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("seller_file_app_idx").on(t.applicationId), index("seller_file_user_idx").on(t.userId)]);
// History: submitted, every admin view / download of a file (PDPA), approve / reject / blacklist / unblacklist with the admin.
export const sellerEvent = pgTable("seller_event", {
  id: text("id").primaryKey(),
  applicationId: text("application_id").notNull().references(() => sellerApplication.id),
  adminId: text("admin_id").references(() => user.id, { onDelete: "set null" }), // null = the applicant
  action: text("action").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("seller_event_app_idx").on(t.applicationId, t.createdAt)]);

// Seller rating: one per customer, order and seller (editable). Seller = name on the order line (CoreCart until marketplace sellers).
export const sellerRating = pgTable("seller_rating", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  seller: text("seller").notNull(),
  stars: integer("stars").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("seller_rating_once").on(t.userId, t.orderId, t.seller), index("seller_rating_seller_idx").on(t.seller)]);
// 6-digit email confirmation code (10 min, 5 tries) next to the Better Auth link. code_hash = HMAC; token = the Better Auth verification token it stands for.
export const emailCode = pgTable("email_code", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  token: text("token").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("email_code_email_idx").on(t.email)]);
// N4: emails the provider refused or that could not be sent after retries (master admin: /admin/emails "Failed sends").
export const emailFailure = pgTable("email_failure", {
  id: text("id").primaryKey(),
  template: text("template").notNull(),
  to: text("to").notNull(),
  error: text("error").notNull(),
  attempts: integer("attempts").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("email_failure_created_idx").on(t.createdAt)]);
// Devices that signed in before (device cookie, stored as a SHA-256 hash). An unknown device = "New sign-in" email.
export const knownDevice = pgTable("known_device", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  deviceHash: text("device_hash").notNull(),
  label: text("label").notNull().default(""),
  ipAddress: text("ip_address"),
  location: text("location"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex("known_device_once").on(t.userId, t.deviceHash)]);

// Site settings (purchase popup, 2026-09-30). key = setting name ("purchase_popup"), value = its JSON (lib/purchase-popup.ts PopupSettings).
export const siteSetting = pgTable("site_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
// Admin audit of setting changes (who, when, what). Never edited.
export const siteSettingEvent = pgTable("site_setting_event", {
  id: text("id").primaryKey(),
  key: text("key").notNull(),
  adminId: text("admin_id").references(() => user.id, { onDelete: "set null" }),
  detail: text("detail").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("site_setting_event_key_idx").on(t.key, t.createdAt)]);

export const schema = { siteSetting, siteSettingEvent, sellerRating, emailCode, knownDevice, sellerApplication, sellerFile, sellerEvent, product, productImage, productKey, topUp, paymentEvent, user, session, account, verification, rateLimit, appRateLimit, orders, orderItems, loginEvent, currency, rateStatus, cartItem, orderKey, keyReveal, favorite, giftCard, walletLedger, promoCode, returnRequest, ticket, ticketMessage, filterGroup, filterOption, menuItem, userAudit };
