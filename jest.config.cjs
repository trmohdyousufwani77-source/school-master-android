/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/tests/**/*.test.(ts|tsx)'],
  transform: {
    '^.+\\.(ts|tsx)$': '<rootDir>/jest.transformer.cjs',
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};
