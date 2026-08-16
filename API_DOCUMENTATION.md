# API Documentation

Base URL (local): `http://localhost:5000/api`

All request/response bodies are JSON. Authenticated routes expect a header:

```
Authorization: Bearer <jwt>
```

Every response follows `{ "success": true, ... }` on success or
`{ "success": false, "message": "..." }` on failure, with an appropriate HTTP status code
(400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 429 rate limited, 500
server error).

---

## Health

### `GET /health`
No auth. Returns `{ success: true, message: "API is running" }`. Useful for uptime checks.

---

## Auth — `/api/auth`

### `POST /auth/register`
Public. Rate-limited (20/15min).

```json
// Request
{ "name": "Jane Doe", "email": "jane@example.com", "password": "secret123" }

// Response 201
{ "success": true, "token": "<jwt>", "user": { "_id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "user", "createdAt": "..." } }
```

### `POST /auth/login`
Public. Rate-limited (20/15min).

```json
// Request
{ "email": "jane@example.com", "password": "secret123" }
// Response 200 - same shape as register
```

### `POST /auth/logout`
Private. Stateless (JWT isn't revoked server-side) — exists as a clean endpoint for the
client to call before discarding its token. `{ success: true, message: "Logged out successfully" }`

### `GET /auth/profile`
Private. Returns the current user: `{ success: true, user: {...} }`

### `PUT /auth/profile`
Private. Body: any of `{ name, phone, address: { street, city, postalCode, country }, avatar }`.
Returns the updated user.

### `PUT /auth/change-password`
Private. Body: `{ currentPassword, newPassword }`. `newPassword` must be 6+ characters.

### `POST /auth/forgot-password`
Public. Rate-limited. Body: `{ email }`. Always returns the same generic success message
regardless of whether the email exists (prevents account enumeration). Sends an email
containing a reset link `{CLIENT_URL}/reset-password/{token}` — or logs it to the server
console if SMTP isn't configured.

### `PUT /auth/reset-password/:resetToken`
Public. Body: `{ password }`. Token is single-use and expires 10 minutes after being
issued. Returns a fresh `{ token, user }` (logs the user in immediately).

---

## Products — `/api/products`

### `GET /products`
Public. Query params (all optional):

| Param | Type | Description |
|---|---|---|
| `keyword` | string | Case-insensitive match against product name |
| `category` | string | Exact category match |
| `minPrice` / `maxPrice` | number | Price range |
| `rating` | number | Minimum average rating |
| `inStock` | `"true"` | Only products with `stock > 0` |
| `sort` | string | `newest` (default) · `oldest` · `price_asc` · `price_desc` · `rating` · `name_asc` |
| `page` | number | Default 1 |
| `limit` | number | Default 12 |

```json
// Response 200
{ "success": true, "count": 12, "total": 40, "page": 1, "pages": 4, "products": [ {...} ] }
```

### `GET /products/top`
Public. Query: `limit` (default 8). Returns highest-rated products — used on the landing page.

### `GET /products/categories`
Public. Returns `{ success: true, categories: ["Beauty", "Books", ...] }` — the distinct
list of categories currently in use.

### `GET /products/:id`
Public. Returns the product plus up to 4 related products (same category):
`{ success: true, product: {...}, relatedProducts: [...] }`

### `POST /products`
Admin only. Body: `{ name, description, price, category, stock, image?, images?, brand? }`.
Returns the created product.

### `PUT /products/:id`
Admin only. Body: any subset of product fields. Returns the updated product.

### `DELETE /products/:id`
Admin only. `{ success: true, message: "Product removed" }`

### `POST /products/:id/reviews`
Private. Body: `{ rating: 1-5, comment }`. One review per user per product — a second
attempt returns 400. Recalculates the product's average `rating`/`numReviews`.

### `DELETE /products/:id/reviews/:reviewId`
Private. Only the review's author or an admin may delete it.

---

## Cart — `/api/cart`

All routes are private and scoped to the logged-in user (`req.user`) — there's no
"cart ID" in the URL, just the one cart per user.

### `GET /cart`
Returns (creating an empty cart if none exists yet), with products populated:
`{ success: true, cart: { items: [{ product: {...}, quantity }] } }`

### `POST /cart`
Body: `{ productId, quantity? }` (default 1). Adds the item, or increases quantity if it's
already in the cart. Quantity is clamped to available stock.

### `PUT /cart/:productId`
Body: `{ quantity }`. Sets the quantity; a value `<= 0` removes the item.

### `DELETE /cart/:productId`
Removes one item from the cart.

### `DELETE /cart`
Empties the entire cart.

---

## Orders — `/api/orders`

All routes require authentication.

### `POST /orders`
Body:
```json
{
  "orderItems": [{ "product": "<productId>", "qty": 2 }],
  "shippingAddress": { "fullName": "...", "address": "...", "city": "...", "postalCode": "...", "country": "...", "phone": "..." },
  "paymentMethod": "COD",
  "couponCode": "WELCOME10"
}
```
The server re-fetches every product's current price and stock — **client-sent prices are
ignored**. Computes `itemsPrice`, applies the coupon if valid, adds shipping (flat $5,
free over $100 after discount) and 8% tax, decrements stock, clears the user's cart, and
returns the created order (`201`).

### `GET /orders/my-orders`
Returns the logged-in user's orders, newest first.

### `GET /orders/:id`
Returns one order. Only the order's owner or an admin may view it (403 otherwise).

### `GET /orders`
**Admin only.** Query: `status`, `page`, `limit` (default 20). Returns all orders with the
customer populated.

### `PUT /orders/:id/status`
**Admin only.** Body: `{ orderStatus?, paymentStatus? }`.
`orderStatus` ∈ `Processing | Shipped | Delivered | Cancelled`.
`paymentStatus` ∈ `pending | paid | failed`. Setting status to `Delivered` also stamps
`isDelivered`/`deliveredAt`.

### `GET /orders/stats/summary`
**Admin only.** Returns aggregated dashboard stats:
```json
{
  "success": true,
  "stats": {
    "totalRevenue": 4213.50,
    "totalOrders": 87,
    "ordersByStatus": [{ "_id": "Processing", "count": 5 }],
    "revenueByDay": [{ "_id": "2026-08-01", "revenue": 120.5, "orders": 3 }],
    "topProducts": [{ "_id": "<productId>", "name": "...", "totalSold": 40, "revenue": 800 }]
  }
}
```

---

## Users — `/api/users`

All routes require authentication.

### `GET /users/wishlist`
Returns the current user's wishlist, populated: `{ success: true, wishlist: [product, ...] }`

### `POST /users/wishlist/:productId`
Toggles the product on/off the wishlist. `{ success: true, added: true|false, wishlist: [...] }`

### `GET /users`
**Admin only.** Query: `page`, `limit`. Paginated list of all users.

### `GET /users/:id`
**Admin only.** Single user by id.

### `PUT /users/:id`
**Admin only.** Body: any of `{ name, email, role }`. Used by the admin dashboard to
promote/demote users.

### `DELETE /users/:id`
**Admin only.** An admin cannot delete their own account through this endpoint (400).

---

## Upload — `/api/upload`

### `POST /upload`
**Admin only.** `multipart/form-data` with a single field `image` (jpg/png/webp/gif, ≤5MB).
Returns `{ success: true, url: "/uploads/<generated-filename>" }` — prefix with the API's
origin to get a fully-qualified URL for use as a product's `image`.

---

## Coupons — `/api/coupons`

### `POST /coupons/apply`
Private (any logged-in user). Body: `{ code, subtotal }`. Validates the code is active,
unexpired, and the subtotal meets `minPurchase`. Returns the discount amount without
creating anything — the actual application happens by passing `couponCode` to
`POST /orders`.

### `POST /coupons`
**Admin only.** Body: `{ code, discountType: "percentage"|"fixed", discountValue, minPurchase?, expiryDate, isActive? }`

### `GET /coupons`
**Admin only.** All coupons, newest first.

### `DELETE /coupons/:id`
**Admin only.**

---

## Error responses

```json
{ "success": false, "message": "Invalid email or password" }
```

| Status | Meaning |
|---|---|
| 400 | Validation failure, business-rule violation (e.g. insufficient stock) |
| 401 | Missing/invalid/expired JWT, or bad credentials |
| 403 | Authenticated but not allowed (wrong role, not the resource owner) |
| 404 | Resource not found, or route doesn't exist |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |
