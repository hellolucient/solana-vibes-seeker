# X (Twitter) OAuth environment variables

The error **"Missing X_CONSUMER_KEY, X_CONSUMER_SECRET, or X_CALLBACK_URL"** means the backend doesn’t have the X OAuth credentials. You need to set them so **Connect X** (check-for-vibe and claim flows) works.

## 1. Create a Twitter Developer app

1. Go to [developer.twitter.com](https://developer.twitter.com/) and sign in.
2. **Developer Portal** → **Projects & Apps** → your project (or create one) → **your App**.
3. Open the **Keys and tokens** tab.
4. Under **Consumer Keys**, copy:
   - **API Key** → use as `X_CONSUMER_KEY`
   - **API Key Secret** → use as `X_CONSUMER_SECRET`
5. Under **User authentication settings** (or **App permissions**), set:
   - **Callback URI / Redirect URL** to your callback URL (see below). It must match **exactly** (including `https` and path).

## 2. Set the callback URL

- **Local:** `http://localhost:3000/api/auth/x/callback`
- **Production (e.g. Vercel):** `https://solana-vibes-seeker.vercel.app/api/auth/x/callback`  
  (Use your real app URL if different.)

Twitter only allows one callback per app in some setups; if you need both local and production, you may need two apps or to switch the callback when deploying.

## 3. Set environment variables

**Local (backend):** In `backend/.env`:

```env
X_CONSUMER_KEY=your_api_key_here
X_CONSUMER_SECRET=your_api_key_secret_here
X_CALLBACK_URL=https://solana-vibes-seeker.vercel.app/api/auth/x/callback
```

For local dev use `X_CALLBACK_URL=http://localhost:3000/api/auth/x/callback` and add that same URL in the Twitter app’s callback list.

**Vercel:** In the project → **Settings** → **Environment Variables**, add:

- `X_CONSUMER_KEY`
- `X_CONSUMER_SECRET`
- `X_CALLBACK_URL` = `https://solana-vibes-seeker.vercel.app/api/auth/x/callback`

Redeploy after changing env vars.

## 4. Restart / redeploy

- Local: restart `npm run dev` in `backend/`.
- Vercel: trigger a new deployment after saving the variables.

After these are set, **check for vibe** and the claim page **Connect X** should work.
