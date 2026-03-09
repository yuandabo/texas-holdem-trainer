import path from 'path';
import { defineConfig } from '@tarojs/cli';
import type { UserConfigExport } from '@tarojs/cli';

export default defineConfig<'webpack5'>({
  projectName: 'texas-holdem-trainer',
  date: '2026-3-6',
  designWidth: 750,
  deviceRatio: {
    640: 2.34 / 2,
    750: 1,
    375: 2,
    828: 1.81 / 2,
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: ['@tarojs/plugin-framework-react', '@tarojs/plugin-platform-h5'],
  defineConstants: {},
  copy: { patterns: [{ from: 'src/robots.txt', to: 'dist/robots.txt' }], options: {} },
  framework: 'react',
  compiler: 'webpack5',
  alias: {
    '@': path.resolve(__dirname, '..', 'src'),
  },
  mini: {
    postcss: {
      pxtransform: { enable: true, config: {} },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]',
        },
      },
    },
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    output: {
      filename: 'js/[name].[hash:8].js',
      chunkFilename: 'js/[name].[chunkhash:8].js',
    },
    postcss: {
      autoprefixer: { enable: true },
    },
    devServer: {
      port: 8080,
      hot: true,
      historyApiFallback: true,
      static: false,
    },
    esnextModules: ['taro-ui'],
  },
}) as UserConfigExport<'webpack5'>;
