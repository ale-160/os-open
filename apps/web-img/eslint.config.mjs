import { createOsEslintConfig } from '@os/eslint-config';

export default createOsEslintConfig({
  ignores: ['public/**'],
  rules: {
    'react-hooks/set-state-in-effect': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react-hooks/immutability': 'warn'
  }
});
