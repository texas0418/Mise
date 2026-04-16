# Mise Film Director Suite

## Project info

This is a native cross-platform mobile app.

**Platform**: Native iOS & Android app, exportable to web
**Framework**: Expo Router + React Native

## How can I edit this code?

### **Use your preferred code editor**

You can clone this repo and push changes.

If you are new to coding and unsure which editor to use, we recommend Cursor. If you're familiar with terminals, try Claude Code.

The only requirement is having Node.js & Bun installed - [install Node.js with nvm](https://github.com/nvm-sh/nvm) and [install Bun](https://bun.sh/docs/installation)

Follow these steps:

```
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
bun i

# Step 4: Start the app
bun run start

# Step 5: Start iOS preview
bun run start -- --ios
```

### **Edit a file directly in GitHub**

* Navigate to the desired file(s).
* Click the "Edit" button (pencil icon) at the top right of the file view.
* Make your changes and commit the changes.

## What technologies are used for this project?

This project is built with the most popular native mobile cross-platform technical stack:

* **React Native** - Cross-platform native mobile development framework created by Meta
* **Expo** - Extension of React Native + platform
* **Expo Router** - File-based routing system for React Native with support for web, server functions and SSR
* **TypeScript** - Type-safe JavaScript
* **React Query** - Server state management
* **Lucide React Native** - Beautiful icons

## How can I test my app?

### **On your phone (Recommended)**

1. **iOS**: Download [Expo Go](https://apps.apple.com/app/expo-go/id982107779)
2. **Android**: Download the [Expo Go app from Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)
3. Run `bun run start` and scan the QR code from your development server

### **In your browser**

Run `bun start-web` to test in a web browser. Note: The browser preview is great for quick testing, but some native features may not be available.

### **iOS Simulator / Android Emulator**

You can test apps in Expo Go. You don't need XCode or Android Studio for most features.

**When do you need Custom Development Builds?**

* Native authentication (Face ID, Touch ID, Apple Sign In)
* In-app purchases and subscriptions
* Push notifications
* Custom native modules

Learn more: [Expo Custom Development Builds Guide](https://docs.expo.dev/develop/development-builds/introduction/)

If you have XCode (iOS) or Android Studio installed:

```
# iOS Simulator
bun run start -- --ios

# Android Emulator
bun run start -- --android
```

## How can I deploy this project?

### **Publish to App Store (iOS)**

1. **Install EAS CLI**:

   ```
   bun i -g @expo/eas-cli
   ```
2. **Configure your project**:

   ```
   eas build:configure
   ```
3. **Build for iOS**:

   ```
   eas build --platform ios
   ```
4. **Submit to App Store**:

   ```
   eas submit --platform ios
   ```

For detailed instructions, visit [Expo's App Store deployment guide](https://docs.expo.dev/submit/ios/).

### **Publish to Google Play (Android)**

1. **Build for Android**:

   ```
   eas build --platform android
   ```
2. **Submit to Google Play**:

   ```
   eas submit --platform android
   ```

For detailed instructions, visit [Expo's Google Play deployment guide](https://docs.expo.dev/submit/android/).

### **Publish as a Website**

Your React Native app can also run on the web:

1. **Build for web**:

   ```
   eas build --platform web
   ```
2. **Deploy with EAS Hosting**:

   ```
   eas hosting:configure
   eas hosting:deploy
   ```

## App Features

This template includes:

* **Cross-platform compatibility** - Works on iOS, Android, and Web
* **File-based routing** with Expo Router
* **Tab navigation** with customizable tabs
* **Modal screens** for overlays and dialogs
* **TypeScript support** for better development experience
* **Async storage** for local data persistence
* **Vector icons** with Lucide React Native

## Project Structure

```
├── app/                    # App screens (Expo Router)
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── _layout.tsx    # Tab layout configuration
│   │   └── index.tsx      # Home tab screen
│   ├── _layout.tsx        # Root layout
│   ├── modal.tsx          # Modal screen example
│   └── +not-found.tsx     # 404 screen
├── assets/                # Static assets
│   └── images/           # App icons and images
├── constants/            # App constants and configuration
├── app.json             # Expo configuration
├── package.json         # Dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Custom Development Builds

For advanced native features, you'll need to create a Custom Development Build instead of using Expo Go.

### **When do you need a Custom Development Build?**

* **Native Authentication**: Face ID, Touch ID, Apple Sign In, Google Sign In
* **In-App Purchases**: App Store and Google Play subscriptions
* **Advanced Native Features**: Third-party SDKs, platform-specific features (e.g. Widgets on iOS)
* **Background Processing**: Background tasks, location tracking

### **Creating a Custom Development Build**

```
# Install EAS CLI
bun i -g @expo/eas-cli

# Configure your project for development builds
eas build:configure

# Create a development build for your device
eas build --profile development --platform ios
eas build --profile development --platform android

# Install the development build on your device and start developing
bun start --dev-client
```

**Learn more:**

* [Development Builds Introduction](https://docs.expo.dev/develop/development-builds/introduction/)
* [Creating Development Builds](https://docs.expo.dev/develop/development-builds/create-a-build/)
* [Installing Development Builds](https://docs.expo.dev/develop/development-builds/installation/)

## Troubleshooting

### **App not loading on device?**

1. Make sure your phone and computer are on the same WiFi network
2. Try using tunnel mode: `bun start -- --tunnel`
3. Check if your firewall is blocking the connection

### **Build failing?**

1. Clear your cache: `bunx expo start --clear`
2. Delete `node_modules` and reinstall: `rm -rf node_modules && bun install`
3. Check [Expo's troubleshooting guide](https://docs.expo.dev/troubleshooting/build-errors/)

### **Need help with native features?**

* Check [Expo's documentation](https://docs.expo.dev/) for native APIs
* Browse [React Native's documentation](https://reactnative.dev/docs/getting-started) for core components
