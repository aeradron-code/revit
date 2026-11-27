const buildArchs = process.env.ANDROID_BUILD_ARCHS?.split(",") ?? [
  "armeabi-v7a",
  "arm64-v8a",
  "x86",
  "x86_64",
];

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ["expo-build-properties", { android: { buildArchs } }],
  ],
});
