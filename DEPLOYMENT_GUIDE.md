# Deployment Guide — Vercel (frontend) + Render (backend)

This deploys the React client to **Vercel** and the Express API to **Render**, with
**MongoDB Atlas** as the database. Push your code to GitHub first — both platforms deploy
from a Git repository.

## 1. Set up MongoDB Atlas

1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas/register).
2. **Database Access** → add a database user with a strong password.
3. **Network Access** → add `0.0.0.0/0` (allow from anywhere) so Render can reach it —
   or, for tighter security, look up Render's static outbound IPs and allowlist those
   specifically.
4. **Connect** → "Drivers" → copy the connection string, e.g.
   `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/ecommerce`

## 2. Deploy the backend to Render

1. [render.com](https://render.com) → **New** → **Web Service** → connect your GitHub repo.
2. Configure:
   | Setting | Value |
   |---|---|
   | Root Directory | `server` |
   | Runtime | Node |
   | Build Command | `npm install` |
   | Start Command | `npm start` |
   | Instance Type | Free (or paid, for no cold starts) |
3. **Environment** tab → add the variables from `server/.env.example`:
   ```
   NODE_ENV=production
   MONGO_URI=<your Atlas connection string>
   JWT_SECRET=<generate a long random string>
   JWT_EXPIRE=30d
   CLIENT_URL=<your Vercel URL, added after step 3 - use a placeholder for now>
   SMTP_HOST=... (optional, for real password-reset emails)
   SMTP_PORT=587
   SMTP_USER=...
   SMTP_PASS=...
   SMTP_FROM="E-Shop <noreply@yourdomain.com>"
   ```
   Leave `PORT` unset — Render injects it automatically and `server.js` already reads
   `process.env.PORT`.
4. Deploy. Once live, note the URL, e.g. `https://eshop-api.onrender.com`. Confirm it's
   up: `https://eshop-api.onrender.com/api/health` should return `{"success":true,...}`.

> **Uploaded images and Render's free tier:** Render's free web services use an ephemeral
> filesystem — anything written to `server/uploads/` (via the admin product image
> upload) is lost on restart/redeploy. For a real deployment, swap the storage engine in
> `server/middleware/upload.js` from `multer.diskStorage` to a cloud provider (e.g.
> `multer-storage-cloudinary` or an S3-compatible adapter) so uploads persist. Product
> `image` fields also accept plain URLs, so pasting an externally-hosted image URL in the
> admin form works today without any code changes.

## 3. Deploy the frontend to Vercel

1. [vercel.com](https://vercel.com) → **Add New** → **Project** → import the same repo.
2. Configure:
   | Setting | Value |
   |---|---|
   | Root Directory | `client` |
   | Framework Preset | Vite |
   | Build Command | `npm run build` (default) |
   | Output Directory | `dist` (default) |
3. **Environment Variables**:
   ```
   VITE_API_URL=https://eshop-api.onrender.com/api
   ```
   (use the Render URL from step 2, with `/api` appended)
4. Deploy. Note your Vercel URL, e.g. `https://eshop.vercel.app`.

## 4. Connect the two

Go back to Render → your service → **Environment** → update `CLIENT_URL` to your real
Vercel URL (`https://eshop.vercel.app`, no trailing slash) → save, which triggers a
redeploy. This matters because the backend's CORS config
(`cors({ origin: process.env.CLIENT_URL })`) and password-reset email links both depend
on it.

## 5. Seed production data (optional)

Render's **Shell** tab (or `render exec`, or a local terminal with `MONGO_URI` pointed at
Atlas) lets you run:

```bash
npm run seed
```

This creates the demo admin/customer accounts and sample catalog — useful for a demo
deployment. **Change or remove the demo admin password before using this for anything
real.**

## 6. Verify

- Visit your Vercel URL, browse products, register an account, add to cart, check out.
- Log in as the seeded admin and confirm `/admin` loads (stats, products, orders, users).
- If API calls fail in the browser console with a CORS error, double check `CLIENT_URL`
  on Render exactly matches your Vercel URL (protocol + no trailing slash).
- If they fail with a network error, double-check `VITE_API_URL` on Vercel and that it
  includes `/api`.

## Notes on scaling

- The API is stateless (JWT-based auth, no server-side sessions), so it's safe to run
  multiple Render instances behind a load balancer without any sticky-session config.
- MongoDB Atlas's free tier (M0) is fine for a demo; for real traffic, monitor connection
  counts — Mongoose's default connection pool is 100 per instance.
- Consider adding a CDN in front of the `/uploads` static route (or moving to
  Cloudinary/S3, per the note above) once you have real product images.
