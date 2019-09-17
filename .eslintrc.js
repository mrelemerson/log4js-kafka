module.exports = {
  root: true,
  env: {
    node: true,
    'jest/globals': true
  },
  plugins: ['jest'],
  extends: 'airbnb-base',
  rules: {
    'no-multiple-empty-lines': [
      'error', {
        'max': 1,
        'maxBOF': 0,
        'maxEOF': 0,
      },
    ],
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'no-debugger': process.env.NODE_ENV === 'production' ? 'error' : 'off',
    'max-len': [
      'error', {
        code: 200,
      },
    ],
  },
  parserOptions: {
  },
  globals: {
  },
};
