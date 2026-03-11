# Solana Seeker dApp Store – Release APK

Build a **release** APK signed with a **new signing key used only for the dApp Store** (required for submission).

**Important:** The store requires an **APK** file that is “downloadable and successfully installable through a standard Android browser flow.” You must submit the **APK** from `assembleRelease` (path below). **Do not submit an Android App Bundle (.aab)** — AAB cannot be installed from a browser; only APK can.

## 1. Create a new dApp Store signing key (one-time)

From the project root, create the keystore in `android/app/`:

```bash
cd android/app
keytool -genkeypair -v -storetype PKCS12 \
  -keystore solana-vibes-dappstore-release.keystore \
  -alias solana-vibes-dappstore \
  -keyalg RSA -keysize 2048 -validity 10000
```

Use a **strong password** and store it and the keystore file safely. This key should be used **only** for the Solana Seeker dApp Store build.

- **Do not** commit the keystore or your passwords.
- Keep a backup of the keystore; you’ll need the same key for future updates.
- **Use a password that works in `keystore.properties`:** avoid characters that `.properties` files treat specially (e.g. `# = : \` and sometimes `'` or `"`). A password with only **letters and numbers** is safest so you can put it in `keystore.properties` and run `./gradlew assembleRelease` without setting env vars. If you already have a keystore whose password causes “keystore password was incorrect,” use the env-var workaround below or create a new keystore with a properties-safe password.
- **Resubmitting an updated build?** If the portal says to "address the items and resubmit an updated build," the listing is still the same—you must sign the new APK with the **same** keystore you used for the first submission. Otherwise the store and Android treat it as a different app. Only create a new keystore if you are starting a brand‑new listing (e.g. the previous one was removed or you are submitting a different app).

## 2. Configure signing in the app

Copy the example properties and fill in your values:

```bash
cd android/app
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties`:

```properties
storeFile=solana-vibes-dappstore-release.keystore
storePassword=YOUR_STORE_PASSWORD
keyAlias=solana-vibes-dappstore
keyPassword=YOUR_KEY_PASSWORD
```

`keystore.properties` is gitignored; do not commit it.

## 3. Build the release APK

From the project root:

```bash
cd android
./gradlew assembleRelease
```

**If you get "keystore password was incorrect"** (e.g. password has special characters like `'`), pass the passwords via environment variables so Gradle doesn’t parse them from the properties file:

```bash
cd android
RELEASE_STORE_PASSWORD=YourActualPassword RELEASE_KEY_PASSWORD=YourActualPassword ./gradlew assembleRelease
```

Use the same password for both if your keystore uses one password for store and key. Alternatively, create a **new** keystore (step 1) with a password that has only letters and numbers, then use that in `keystore.properties` so you don’t need env vars for future builds.

When you see **BUILD SUCCESSFUL**, the signed release APK is at:

```
android/app/build/outputs/apk/release/app-release.apk
```

Submit this **single APK** to the Solana Seeker dApp Store (not a debug build, not an .aab). The build is configured to produce one universal APK so one download works on all devices when opened in the browser.

**If the store hosts the file:** For “successfully installable through a standard Android browser flow,” the download URL should be served with `Content-Type: application/vnd.android.package-archive` and `Content-Disposition: inline; filename="app-release.apk"`. Using `inline` (not `attachment`) makes opening the URL trigger the Install prompt directly instead of saving to Downloads.

### Verify the APK is directly accessible (recommended before submitting)

The store's requirement is that the APK be **downloadable and installable through a standard Android browser**: user opens a direct link in Chrome (or similar), the file downloads, and Android shows the **Install** prompt. If you only test by installing from a Dropbox (or other) link, the host may serve the file with a different `Content-Type` or redirect in a way that works on your device but fails for the store's check or for other users.

**How to check:**

1. **Serve the APK with the correct headers**  
   Copy your built release APK so it's available at a direct URL that sends:
   - `Content-Type: application/vnd.android.package-archive`
   - `Content-Disposition: inline; filename="app-release.apk"` (use `inline` so opening the URL triggers the Install prompt; `attachment` would save to Downloads only)

2. **Option A – Use this repo's backend (one-off test)**  
   - Build the release APK: `cd android && ./gradlew assembleRelease`  
   - Copy it to the backend public folder:  
     `cp android/app/build/outputs/apk/release/app-release.apk backend/public/app-release.apk`  
   - Deploy the backend: from the **repository root** (parent of `backend/`) run `vercel --prod` and link to your existing project if asked. (Running from inside `backend/` can cause a "backend/backend" path error if the project’s Root Directory is set to `backend`.)  
   - The project's `backend/vercel.json` is set so that `https://<your-backend-domain>/app-release.apk` is served with the correct headers.  
   - On an **Android device**, open **Chrome** and go to: `https://solana-vibes-seeker.vercel.app/app-release.apk` (or your backend URL).  
   - Confirm: the file downloads and Android shows the **Install** prompt. If you get "Can't open file" or no Install option, the URL or headers are wrong.  
   - Remove the APK from `backend/public/` and redeploy when you're done testing (the file is gitignored so it won't be committed).

3. **Option B – Use another host**  
   Use a host that lets you set the APK's `Content-Type` to `application/vnd.android.package-archive` (e.g. some CDNs or a small server you control). Then open that **direct** APK URL in Android Chrome and confirm download + Install.

4. **Why Dropbox (or similar) isn't enough**  
   Dropbox often serves files with a generic type or a download page instead of a direct binary response with the right `Content-Type`. That can work when you "Open" the file from the Dropbox app, but it doesn't prove the "standard browser flow" the store expects. Testing with a direct URL and correct headers (as above) does.

For future release builds, use the same command (with the env vars if you use them):

```bash
cd android
RELEASE_STORE_PASSWORD=YourPassword RELEASE_KEY_PASSWORD=YourPassword ./gradlew assembleRelease
```

## Optional: SHA-256 for App Links

If you use the same certificate for Android App Links (e.g. claim URLs), add its SHA-256 fingerprint to `assetlinks.json`:

```bash
keytool -list -v -keystore android/app/solana-vibes-dappstore-release.keystore \
  -alias solana-vibes-dappstore -storepass YOUR_STORE_PASSWORD -keypass YOUR_KEY_PASSWORD | \
  grep "SHA256:" | sed 's/.*SHA256: //' | tr -d ':'
```

Put that value in `sha256_cert_fingerprints` in `backend/public/.well-known/assetlinks.json`.

---

## Troubleshooting: dApp NFT not in wallet after submission

The **dApp NFT** is part of the Solana Seeker dApp Store’s **portal flow** (their website), not this app’s code. When you submit via the portal and connect your wallet, the store typically mints or airdrops a dApp NFT to that wallet to register your listing. If that NFT never appears, the mint/transfer step failed on their side or during your session.

**Common reasons the dApp NFT never shows up:**

1. **Wrong network** — The portal may mint on **mainnet-beta**. If your wallet was set to devnet (or the portal used a different cluster), the NFT could be on the other network. Check both in a block explorer (see below).
2. **Transaction failed or was never sent** — Network congestion, RPC issues, or a closed popup can prevent the mint tx from being sent or confirmed. You may have signed but the tx didn’t land.
3. **Wallet disconnected or switched** — If you disconnected or switched wallets after signing, the NFT would go to the wallet that actually signed (the one connected at the time of the mint).
4. **Insufficient SOL** — If the portal requires you to pay gas (or a fee), the tx can fail if the connected wallet didn’t have enough SOL.
5. **Popup or extension blocked** — On desktop, the wallet approval popup might have been blocked; the portal might think the flow completed when it didn’t.

**What to do:**

- **Check the correct wallet** on [Solscan](https://solscan.io) or [Solana Explorer](https://explorer.solana.com): look at the wallet address you used on the portal and filter by NFTs (or check transaction history for that session).
- **Confirm network** — In the explorer, ensure you’re on mainnet-beta (or whatever network the store uses).
- **Contact the Solana Seeker dApp Store** — They can confirm whether a mint was attempted for your wallet and why it might have failed (e.g. RPC error, rejection).
- **Retry submission** — Use the same wallet, ensure it’s on the right network and has some SOL, and complete the flow again without closing the wallet popup until the portal shows success.

### NFT shows in Solscan but not in wallet app or portal

If [Solscan](https://solscan.io) shows the dApp NFTs (e.g. **solana_vibes** / **solana_vibes v1.0**) for your address but they don’t appear in your wallet or in the store portal:

- **Wallet app (Phantom, Solflare, etc.):** The NFTs are on-chain; the wallet UI may hide some NFTs (e.g. unverified collections), filter by collection, or cache. Try: refresh/pull-to-refresh, check a “Hidden” or “Unverified” section, or look under “Collectibles” / “NFTs” for the same address. Solscan is the source of truth.
- **Store portal (“no dApp NFT”):** The portal may be reading a different wallet, or only recognize a specific NFT type. Use the **exact same wallet** you see on Solscan when connecting to the portal (same address: `9GsuAxy32SSgqD2qp9EfbNF7gPgbFo9hRhXDRwiM1F2Z` or whichever holds the NFTs). Disconnect and reconnect that wallet on the portal, or try in an incognito window. If it still says you have no dApp NFT, contact the Solana Seeker dApp Store support and mention that Solscan shows the NFTs for that address—they may need to fix their detection or whitelist.

### Wrong or old app URLs in dApp NFT metadata (e.g. external_url)

The dApp NFT’s metadata (name, description, **external_url**, `extensions.solana_dapp_store`, etc.) is set when you create or update the listing on the **store’s portal**, not by this repo. If you previously listed another app (e.g. Sudoku Clash) with the same wallet, the portal may have reused or prefilled that data, so the NFT can still show **external_url** or **website** pointing to the old app (e.g. `https://sudokuclash.com/`).

**That can cause rejection or wrong behavior:** the store may validate that the listing matches the submitted app (e.g. domain / deep links), or users may be sent to the wrong site. Fix it on the portal:

- When submitting or editing the **Solana Vibes Seeker** listing, set **external_url** (and any “website” or “app link” field) to this app’s URL: **`https://solana-vibes-seeker.vercel.app`** (or your production app URL).
- In publisher/release details, set **website** to the same, and keep **license_url**, **copyright_url**, **privacy_policy_url** pointing to the Solana Vibes Seeker legal pages (e.g. `https://solana-vibes-seeker.vercel.app/legal/license`, etc.).

If the portal doesn’t let you edit the existing NFT metadata, ask the Solana Seeker dApp Store to update the listing metadata or re-mint so **external_url** and website match this app.
