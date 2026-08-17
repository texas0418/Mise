const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Native-only modules stubbed on WEB so the desktop build can bundle.
// Every module named here needs a real .web fallback in the screen that
// uses it before the desktop build ships — this list IS the workload.
const WEB_STUBS = [
  "react-native-pdf",
  "react-native-blob-util",
  "react-native-purchases",
];

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && WEB_STUBS.some((m) => moduleName === m || moduleName.startsWith(m + "/"))) {
    return { filePath: path.resolve(__dirname, "web-stubs/empty.js"), type: "sourceFile" };
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
