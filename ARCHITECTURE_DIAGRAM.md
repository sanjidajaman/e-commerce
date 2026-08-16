# System Architecture

## High-level overview

```mermaid
flowchart TB
    subgraph Client["Browser"]
        UI["React SPA (Vite build)<br/>Context API state · Axios · React Router"]
    end

    subgraph Frontend["Frontend hosting - e.g. Vercel"]
        Static["Static assets<br/>(HTML/CSS/JS bundle)"]
    end

    subgraph Backend["Backend hosting - e.g. Render"]
        direction TB
        MW["Middleware pipeline<br/>Helmet · CORS · Rate limit · Sanitizer · JWT auth"]
        Routes["Routes"]
        Controllers["Controllers"]
        Models["Mongoose Models"]
        Uploads["/uploads static files<br/>(Multer disk storage)"]
        MW --> Routes --> Controllers --> Models
        Controllers --> Uploads
    end

    subgraph DataLayer["Data layer"]
        Mongo[("MongoDB<br/>(Atlas or self-hosted)")]
    end

    subgraph External["External services"]
        SMTP["SMTP provider<br/>(password reset / welcome emails)"]
    end

    UI -- "loads app from" --> Static
    UI -- "HTTPS + JWT Bearer token<br/>REST/JSON" --> MW
    Models -- "Mongoose ODM" --> Mongo
    Controllers -- "nodemailer" --> SMTP
```

## Request lifecycle (example: placing an order)

```mermaid
sequenceDiagram
    participant U as User (browser)
    participant R as React App
    participant A as Express API
    participant DB as MongoDB

    U->>R: Click "Place Order" on Checkout page
    R->>A: POST /api/orders (JWT in Authorization header)
    A->>A: helmet, CORS, rate limit, sanitize
    A->>A: protect middleware verifies JWT
    A->>DB: Re-fetch each product's current price & stock
    DB-->>A: Product documents
    A->>A: Recompute itemsPrice/tax/shipping/total server-side<br/>(client-sent prices are never trusted)
    A->>DB: Insert Order document
    A->>DB: Decrement stock on each Product
    A->>DB: Clear the user's saved Cart
    A-->>R: 201 Created { order }
    R->>U: Redirect to Order Success page
```

## Layer responsibilities

| Layer | Responsibility |
|---|---|
| **React SPA** | Rendering, client-side routing, optimistic UI (e.g. cart updates), form validation |
| **Context (Auth/Cart/Theme)** | Cross-cutting client state that many components need, without prop drilling |
| **Services (axios)** | One file per API resource; the only place that knows API URLs/shapes |
| **Express middleware** | Cross-cutting request concerns: security headers, CORS, rate limiting, input sanitization, JWT verification |
| **Routes** | URL → controller mapping, plus per-route middleware (auth, validation, upload) |
| **Controllers** | Request/response handling and business logic (pricing, stock checks, aggregation) |
| **Models (Mongoose)** | Schema, validation, and instance methods (password hashing, JWT signing, review-rating recalculation) |
| **MongoDB** | Persistence |

## Why this split

- **Stateless API + JWT** means the backend can be horizontally scaled (multiple Render
  instances) without a shared session store - any instance can verify any request's
  token independently.
- **Server-side price/stock re-validation** on order creation means the frontend is never
  a trust boundary - a tampered request still gets priced from the database, not the
  request body.
- **Local file storage for uploads** is the simplest option for a single-instance
  deployment and keeps the bonus "Image Upload with Multer" requirement self-contained,
  but it means uploaded images won't survive a redeploy on ephemeral-filesystem hosts
  like Render's free tier - see the [deployment guide](DEPLOYMENT_GUIDE.md) for the
  cloud-storage swap-in point.
