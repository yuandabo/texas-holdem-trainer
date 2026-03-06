/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(scss|css|less)$': '<rootDir>/src/__mocks__/styleMock.js',
    },
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
    },
};
