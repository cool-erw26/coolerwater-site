// Vercel serverless function — returns a short-lived signature/token/expire
// that the ImageKit client-side SDK needs before every upload. The private
// key never leaves this server-side file; it's read from an environment
// variable (set in the Vercel dashboard, never committed to the repo).
const ImageKit = require('imagekit');

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

module.exports = (req, res) => {
  // Storefront pages are on a different origin (Shopify) than this function
  // (Vercel), so the browser needs explicit permission to call it cross-origin.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const authenticationParameters = imagekit.getAuthenticationParameters();
  res.status(200).json(authenticationParameters);
};
