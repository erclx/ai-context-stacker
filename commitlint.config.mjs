const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Ensure subject is always lowercase
    'subject-case': [2, 'always', 'lower-case'],
  },
}

export default config