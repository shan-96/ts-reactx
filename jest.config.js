const pkgJason = require('./package.json')

module.exports = {
  preset: 'ts-jest',
  globals: {
    "ts-jest": {
      tsconfig: "tsconfig.json"
    }
  },
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  testRegex: '(/test/.*.(test|spec)).(js|ts)$',
  moduleFileExtensions: ['ts', 'js'],
  collectCoverage: true,
  coveragePathIgnorePatterns: ['(test/.*.mock).(js|ts)$'],
  verbose: true,
  projects: ['<rootDir>'],
  coverageDirectory: '<rootDir>/coverage/',
  testEnvironment: "node",
  setupFiles: [
    './test/jest.setup.js',
  ],
  name: pkgJason.name,
  displayName: pkgJason.name,
}
