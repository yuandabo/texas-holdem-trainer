/** @type {import('jest').Config} */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    testMatch: ['**/__tests__/**/*.test.ts'],
    transformIgnorePatterns: [
        'node_modules/(?!uuid)',
    ],
    moduleNameMapper: {
        '^@engine/(.*)$': '<rootDir>/../src/engine/$1',
    },
    transform: {
        '^.+\\.tsx?$': 'ts-jest',
        '^.+\\.jsx?$': 'ts-jest',
    },
};
