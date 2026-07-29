/** @type {import('jest').Config} */
module.exports = {
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^lucide-react-native$":
      "<rootDir>/../../node_modules/lucide-react-native/dist/cjs/lucide-react-native.js",
  },
  preset: "jest-expo",
  testMatch: [
    "<rootDir>/__tests__/**/*.test.ts?(x)",
    "<rootDir>/src/**/*.test.ts?(x)",
  ],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|expo-modules-core|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|lucide-react-native|react-native-paper|react-native-safe-area-context|react-native-svg)/)",
  ],
};
