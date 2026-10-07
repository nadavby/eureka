/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  globalSetup: "<rootDir>/src/tests/setup/global-setup.ts",
  globalTeardown: "<rootDir>/src/tests/setup/global-teardown.ts",
  setupFiles: ["<rootDir>/src/tests/setup/env.ts"],
};
