const fs = require('fs');
const base = require('./app.json');

function resolveGoogleServicesFile() {
  const easFile = process.env.GOOGLE_SERVICES_JSON;
  if (easFile) return easFile;

  const localFile = './google-services.json';
  if (fs.existsSync(localFile)) return localFile;

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
