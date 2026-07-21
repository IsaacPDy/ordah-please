/** @type {import('jest').Config} */
module.exports = {
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  preset: "jest-expo",
  testMatch: ["<rootDir>/__tests__/**/*.test.ts?(x)"],
};
