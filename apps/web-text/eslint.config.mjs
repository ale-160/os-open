import { createOsEslintConfig } from '@os/eslint-config';

export default createOsEslintConfig({
  rules: {
    'react-hooks/set-state-in-effect': 'off'
  }
});
