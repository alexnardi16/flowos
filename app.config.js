const fs = require('fs');
const base = require('./app.json');

function resolveGoogleServicesFile() {
  const easFile = process.env.GOOGLE_SERVICES_JSON;
  if (easFile) return easFile;

  const localFile = './google-services.json';
  if (fs.existsSync(localFile)) return localFile;

  if (process.env.EAS_BUILD === '1') {
    throw new Error('GOOGLE_SERVICES_JSON is required for EAS Android builds. Upload google-services.json as an EAS file environment variable.');
  }

  return undefined;
}

const googleServicesFile = resolveGoogleServicesFile();

module.exports = {
  ...base.expo,
  android: {
    ...base.expo.android,
    ...(googleServicesFile ? { googleServicesFile } : {}),
  },
};
