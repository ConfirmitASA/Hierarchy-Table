const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const AUTOPREFIXER_BROWSERS = [
  'Android 2.3',
  'Android >= 4',
  'Chrome >= 32',
  'Firefox >= 28',
  'Explorer >= 9',
  'iOS >= 7',
  'Opera >= 12',
  'Safari >= 7.1'
];

module.exports = {
  entry: {
    js:"./src/main.js",
    css:"./src/main.css"
  },
  output: {
    path: "./dist",
    filename: "bundle.js"
  },
  devtool: "eval-source-map",//"source-map",
  module: {
    loaders: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: "babel-loader"
      },
      {
        test:   /\.css$/,
        exclude: /node_modules/,
        loader:  ExtractTextPlugin.extract("style","css!postcss")
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin('styles.css')

    /*new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      },
      output: {
        comments: false
      }
    })*/
  ],
  postcss: function (webpack) {
    return [
      require("postcss-import")({
        addDependencyTo: webpack
      }),
      require("postcss-apply")(),
      require("postcss-cssnext")({
        browsers:AUTOPREFIXER_BROWSERS
      })
      //require('postcss-inline-svg')(),
      //require('cssnano')()
    ];
  },
  watch:true
};
