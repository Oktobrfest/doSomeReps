const path = require('path');



const isDevelopment= process.env.NODE_ENV !== 'production';
const NODE_ENV= isDevelopment ? 'development' : 'production';


const config = {
  mode: NODE_ENV,
  entry: {
    // main: './repz/static/js/index.js',
    vendor: ['pdfjs-dist', 'prismjs']   
  },
  output: {
    path: path.resolve(__dirname, 'repz/static/dist'),
    filename: '[name].bundle.js',  // Generates `main.bundle.js` and `vendor.bundle.js`
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
    ],
  },
  optimization: {
    splitChunks: {
      chunks: 'all',  // Splits vendor and app code into separate chunks
    },
  },
};


// console.log('Resolved path:', path.resolve(__dirname, 'node_modules'));
// console.log('Webpack Resolve Config:', config.resolve);
// console.log('Webpack Module Rules:', config.module.rules);


module.exports = config;