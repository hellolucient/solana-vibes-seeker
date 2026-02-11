# Solana Vibes Seeker

A native Android app for sending and claiming "vibes" - unique NFTs on Solana. Built with React Native and Solana Mobile Stack (MWA).

## Features

- **Mobile Wallet Adapter (MWA)**: Connect with Phantom, Solflare, or any MWA-compatible wallet
- **Send Vibes**: Mint unique NFTs and share claim links with friends
- **Claim Vibes**: Verify your X (Twitter) identity and claim NFTs sent to you
- **True Native App**: Not a WebView wrapper - real React Native with native wallet integration

## Prerequisites

- Node.js 18+
- Java 17 (for Android builds)
- Android Studio with Android SDK
- An Android device or emulator (API 24+)

## Quick Start

```bash
# Clone the repo
git clone https://github.com/hellolucient/solana-vibes-seeker.git
cd solana-vibes-seeker

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Start Metro bundler
npm start

# In another terminal, build and run on Android
npm run android
```

## Building the APK

### Debug APK

```bash
# Generate debug APK
cd android
./gradlew assembleDebug

# APK location: android/app/build/outputs/apk/debug/app-debug.apk
```

### Release APK

1. **Generate a signing key** (first time only):

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

2. **Configure signing** in `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=*****
MYAPP_UPLOAD_KEY_PASSWORD=*****
```

3. **Build release APK**:

```bash
cd android
./gradlew assembleRelease

# APK location: android/app/build/outputs/apk/release/app-release.apk
```

## Project Structure

```
solana-vibes-seeker/
├── android/                 # Native Android project
│   ├── app/                 # Main application module
│   └── gradle/              # Gradle wrapper
├── src/
│   ├── App.tsx              # Root component
│   ├── components/          # Reusable UI components
│   │   └── WalletButton.tsx # Wallet connection button
│   ├── hooks/               # Custom hooks
│   │   ├── useMobileWallet.ts  # MWA integration
│   │   └── useVibeApi.ts    # Backend API calls
│   ├── navigation/          # React Navigation setup
│   │   └── RootNavigator.tsx
│   ├── providers/           # Context providers
│   │   └── ConnectionProvider.tsx
│   ├── screens/             # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── SendVibeScreen.tsx
│   │   ├── ClaimVibeScreen.tsx
│   │   └── ProfileScreen.tsx
│   └── stores/              # Zustand state management
│       └── walletStore.ts
├── index.js                 # Entry point
├── package.json
└── tsconfig.json
```

## How It Works

### Sending a Vibe

1. Connect your wallet using Mobile Wallet Adapter
2. Enter the X username of the person you want to vibe
3. Sign the transaction (costs ~0.006 SOL)
4. Share the claim link with them

### Claiming a Vibe

1. Open the claim link
2. Connect your wallet
3. Verify you own the X account
4. Sign to claim (costs ~0.001 SOL)
5. The NFT is now in your wallet!

## Tech Stack

- **React Native 0.76** - Native mobile framework
- **Solana Mobile Stack** - Mobile Wallet Adapter 2.0
- **React Navigation 7** - Mobile-first navigation
- **Zustand** - Lightweight state management
- **TypeScript** - Type safety

## Backend

This app uses the existing [solana-vibes](https://github.com/hellolucient/solana-vibes) backend deployed at `solana-vibes.vercel.app`. The backend handles:

- NFT minting with Metaplex Core
- Image generation
- Supabase database for vibe records
- X OAuth verification

## Deep Linking

The app supports deep links for claim URLs. Clicking a claim link opens the app if installed, or shows a web claim page where users can connect X and wallet to claim without the app:

- **Custom scheme**: `solanavibes://claim/{vibeId}`
- **Universal link**: `https://solana-vibes-seeker.vercel.app/v/{vibeId}` (web claim or open in app)

## License

MIT
