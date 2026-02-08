# Setup Instructions

## Prerequisites

Before you can build and run the app, you need:

1. **Node.js 18+** - [Download](https://nodejs.org/)
2. **Java 17** - Required for Android builds
3. **Android Studio** - [Download](https://developer.android.com/studio)
   - Install Android SDK (API 35)
   - Install Android SDK Build-Tools
   - Install NDK (version 27.1.12297006)
4. **Watchman** (macOS) - `brew install watchman`

## Initial Setup

### 1. Install Dependencies

```bash
cd solana-vibes-seeker
npm install
```

### 2. Initialize Gradle Wrapper

The gradle wrapper JAR isn't included in the repo. Initialize it:

```bash
cd android
gradle wrapper
cd ..
```

Or copy from another React Native project.

### 3. Create Environment File

```bash
cp .env.example .env
```

Edit `.env` with your configuration if needed.

### 4. Connect Android Device/Emulator

Either:
- Connect an Android device via USB with Developer Mode enabled
- Start an Android emulator from Android Studio

### 5. Run the App

```bash
# Start Metro bundler
npm start

# In another terminal
npm run android
```

## Common Issues

### "SDK location not found"

Create `android/local.properties`:

```properties
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

### Gradle build fails

Try cleaning:

```bash
cd android
./gradlew clean
cd ..
npm run android
```

### Metro bundler issues

Reset cache:

```bash
npm start -- --reset-cache
```

## Testing MWA

To test Mobile Wallet Adapter:

1. Install a wallet app that supports MWA (Phantom, Solflare, etc.)
2. Run the app on a real device (not emulator)
3. Tap "Connect Wallet" - it should open your wallet app

## Building Release APK

See README.md for full instructions on creating a signed release APK.
