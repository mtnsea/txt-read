//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

import path from "path";
import webpack from "webpack";
import { fileURLToPath } from "url";
import { VueLoaderPlugin } from "vue-loader";
import HtmlWebpackPlugin from "html-webpack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @param {Object} env
 * @param {{ mode: 'production' | 'development' | 'none' | undefined }} argv
 * @returns { WebpackConfig[] }
 */
export default function (env, argv) {
  const mode = argv.mode || "none";

  return [
    {
      target: "node",
      mode: mode,
      entry: {
        extension: "./src/extension.ts",
      },
      output: {
        path: path.join(__dirname, "dist"),
        filename: "extension.js",
        libraryTarget: "commonjs2",
      },
      externals: {
        vscode: "commonjs vscode",
      },
      resolve: {
        extensions: [".ts", ".js"],
        mainFields: ["module"],
      },
      module: {
        rules: [
          {
            test: /\.ts$/,
            exclude: /node_modules/,
            use: ["ts-loader"],
          },
        ],
      },
      devtool: mode === "production" ? false : "source-map",
      infrastructureLogging: {
        level: "log",
      },
    },
    getWebviewsConfig(mode, env),
  ];
}

/**
 * @param { 'production' | 'development' | 'none' } mode
 * @param { Object } env
 * @returns { WebpackConfig }
 */
function getWebviewsConfig(mode, env) {
  const basePath = path.join(__dirname, "src", "webviews");
  return {
    name: "webviews",
    context: basePath,
    entry: {
      panel: "./panel.ts",
    },
    mode: mode,
    target: "web",
    devtool: mode === "production" ? false : "source-map",
    output: {
      path: path.join(__dirname, "dist", "webviews"),
      filename: "[name].js",
      chunkFilename: "[name].js",
      libraryTarget: "module",
    },
    experiments: {
      outputModule: true,
    },
    optimization: {
      splitChunks: {
        cacheGroups: {
          default: false,
          vendors: false,
        },
      },
    },
    module: {
      rules: [
        {
          test: /\.vue$/,
          loader: "vue-loader",
        },
        {
          test: /\.ts$/,
          exclude: /node_modules/,
          loader: "ts-loader",
          options: {
            appendTsSuffixTo: [/\.vue$/],
          },
        },
        {
          test: /\.scss$/,
          use: ["style-loader", "css-loader", "sass-loader"],
        },
        {
          test: /\.(png|jpe?g|gif|svg)$/,
          use: [
            {
              loader: "file-loader",
              options: {
                name: "[name].[hash].[ext]",
              },
            },
          ],
        },
      ],
    },
    resolve: {
      alias: {
        vue$: "vue/dist/vue.esm-bundler.js",
      },
      extensions: [".ts", ".js", ".vue", ".json"],
      modules: [basePath, "node_modules"],
    },
    plugins: [
      new webpack.DefinePlugin({
        // webpack自带该插件，无需单独安装
        "process.env": {
          NODE_ENV: process.env.NODE_ENV, // 将属性转化为全局变量，让代码中可以正常访问
        },
      }),
      new HtmlWebpackPlugin({
        template: path.join(__dirname, "src", "webviews", `panel.html`),
        chunks: ["panel"],
        filename: path.join(__dirname, "dist", "webviews", `panel.html`),
        inject: true,
        scriptLoading: "module",
      }),
      new VueLoaderPlugin(),
    ],
    infrastructureLogging: {
      level: "log",
    },
  };
}
