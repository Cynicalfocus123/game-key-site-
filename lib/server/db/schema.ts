import { bigint, boolean, index, integer, numeric, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

// Better Auth core tables + CoreCart user fields.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  // customer | seller | admin. Marketplace seller onboarding comes later.
  role: text("role").notNull().default("customer"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("orders_user_idx").on(t.userId)]);

export const orderItems = pgTable("order_items", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // game_key | hardware
  platform: text("platform"),
  region: text("region"),
  quantity: integer("quantity").notNull().default(1),
  unitPriceCents: integer("unit_price_cents").notNull(),
}, (t) => [index("order_items_order_idx").on(t.orderId)]);

// One row per successful sign-in. Kept after sign-out so admins see login history.
export const loginEvent = pgTable("login_event", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  method: text("method").notNull(), // email | google | email-verify
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
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

export const schema = { user, session, account, verification, rateLimit, orders, orderItems, loginEvent, currency, rateStatus, cartItem };
