module.exports = {
  root: true,
  extends: [require.resolve('../../eslint.config.js')],
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  parserOptions: {
    project: './tsconfig.json',
    ecmaVersion: 2022,
    sourceType: 'module',
  },
}; 