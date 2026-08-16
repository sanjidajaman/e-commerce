# Entity-Relationship Diagram

This reflects the actual Mongoose schemas in `server/models/`. MongoDB is schema-flexible,
but the application enforces this shape at the ODM layer.

```mermaid
erDiagram
    USER ||--o| CART : "has one"
    USER ||--o{ ORDER : places
    USER ||--o{ REVIEW : writes
    USER }o--o{ PRODUCT : wishlists
    PRODUCT ||--o{ REVIEW : receives
    PRODUCT ||--o{ CART_ITEM : "referenced by"
    PRODUCT ||--o{ ORDER_ITEM : "referenced by"
    CART ||--o{ CART_ITEM : contains
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER }o--o| COUPON : "may apply"

    USER {
        ObjectId _id PK
        string name
        string email UK
        string password "bcrypt hash, select false"
        string role "user or admin"
        string phone
        object address "street, city, postalCode, country"
        ObjectId[] wishlist FK "-> PRODUCT"
        string resetPasswordToken "hashed, temporary"
        date resetPasswordExpire
        date createdAt
    }

    PRODUCT {
        ObjectId _id PK
        string name
        string description
        number price
        string image
        string[] images
        string category
        string brand
        number stock
        number sold
        number rating "computed avg of reviews"
        number numReviews
        REVIEW[] reviews "embedded subdocuments"
        ObjectId user FK "-> USER, creator"
        date createdAt
    }

    REVIEW {
        ObjectId _id PK
        ObjectId user FK "-> USER"
        string name "denormalized reviewer name"
        number rating "1-5"
        string comment
        date createdAt
    }

    CART {
        ObjectId _id PK
        ObjectId user FK "-> USER, unique"
        CART_ITEM[] items "embedded subdocuments"
        date updatedAt
    }

    CART_ITEM {
        ObjectId product FK "-> PRODUCT"
        number quantity
    }

    ORDER {
        ObjectId _id PK
        ObjectId user FK "-> USER"
        ORDER_ITEM[] orderItems "embedded, price-snapshotted"
        object shippingAddress "fullName, address, city, postalCode, country, phone"
        string paymentMethod "COD, Card, PayPal"
        string paymentStatus "pending, paid, failed"
        number itemsPrice
        number shippingPrice
        number taxPrice
        number totalPrice
        object couponApplied "code, discount - optional"
        string orderStatus "Processing, Shipped, Delivered, Cancelled"
        boolean isDelivered
        date deliveredAt
        date createdAt
    }

    ORDER_ITEM {
        ObjectId product FK "-> PRODUCT"
        string name "snapshotted at order time"
        string image "snapshotted at order time"
        number price "snapshotted at order time"
        number qty
    }

    COUPON {
        ObjectId _id PK
        string code UK
        string discountType "percentage or fixed"
        number discountValue
        number minPurchase
        date expiryDate
        boolean isActive
    }
```

## Notes on the design

- **Reviews are embedded in Product**, not a separate top-level collection. This matches
  the brief's schema (`Products.reviews`) and keeps "get product + its reviews" to a
  single read. The trade-off is that a very heavily-reviewed product grows one document;
  acceptable at this scale, but a collection with the usual `product`/`user` fields would
  be the fix at a much larger scale.
- **Order line items snapshot `name`/`image`/`price`** at the moment of purchase, rather
  than only storing a `Product` reference. This is deliberate: if a product's price or
  name changes later, past orders must still show what the customer actually paid for.
- **Cart items only store a reference + quantity** (no price snapshot) because a cart, unlike
  an order, is expected to reflect *current* prices until checkout.
- **Wishlist is a plain array of `ObjectId`s on User** rather than a join collection,
  since it carries no extra fields (no "date added", no notes) - if that changes, it
  would become its own collection.
