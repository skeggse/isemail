import babel from 'rollup-plugin-babel';

export default {
  input: 'lib/index.js',
  plugins: [
    babel({
      presets: [
        '@babel/preset-flow',
        // ['@babel/preset-env', {
        //   modules: false,
        //   // targets: {
        //   //   node: '>= 6',
        //   // },
        // }],
      ],
      include: '**/*.js',
      exclude: ['node_modules/**'],
    })
  ],
  output: {
    file: 'dist/index.js',
    format: 'esm',
    exports: 'auto',
  },
};
