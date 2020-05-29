module.exports = {
    'env': {
        'es6': true
    },
    'extends': 'eslint:recommended',
    'globals': {
        'process': true
    },
    'settings': {
        'import/resolver': {
            'node': {
                'extensions': ['.js', '.jsx', '.ts', '.tsx']
            }
        }
    },
    'parser': '@typescript-eslint/parser',
    'parserOptions': {
        'project': 'tsconfig.json',
        'sourceType': 'module'
    },
    'plugins': [
        '@typescript-eslint',
        'eslint-plugin-import'
    ],
    'rules': {
        '@typescript-eslint/indent': ['error', 4],
        '@typescript-eslint/no-require-imports': 'error',
        '@typescript-eslint/quotes': [
            'error',
            'single'
        ],
        'comma-dangle': 'error',
        'curly': 'error',
        'eqeqeq': [
            'error',
            'always'
        ],
        'no-trailing-spaces': 'error',
        'no-var': 'error',
        'prefer-const': 'error',
        'no-console': 'error',
        'no-unused-vars': ['error', { 'args': 'none' }],
        'no-throw-literal': 'error',
        'no-trailing-spaces': 'error',
        'import/no-extraneous-dependencies': 'error',
        'import/no-cycle': 'error',
        'import/no-self-import': 'error',
        'import/no-unresolved': 'error'
    },
    'overrides': [{
        'files': ['*.ts', '*.tsx'],
        'rules': {
            '@typescript-eslint/no-unused-vars': [2, { args: 'none' }],
            'no-undef': 'off'
        }
    }]
};
