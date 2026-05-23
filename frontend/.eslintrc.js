module.exports = {
  extends: ['react-app'],
  rules: {
    'no-unused-vars': 'warn',
    // Re-enabled as a warning (was 'off' — hid a real missing-dep bug in App.js#handleInitialize).
    'react-hooks/exhaustive-deps': 'warn',
    'no-console': 'off',
    'jsx-a11y/anchor-is-valid': 'off',
  },
};
