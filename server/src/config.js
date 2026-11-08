const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

function parseDatabaseUrl(rawUrl) {
  if (!rawUrl) return null;

  const url = new URL(rawUrl);
  const sslMode = (
    url.searchParams.get('ssl-mode') ||
    url.searchParams.get('sslmode') ||
    ''
  ).toUpperCase();

  let password = url.password;
  try {
    password = decodeURIComponent(password);
  } catch {
    // Keep the raw value if it is not valid percent-encoding.
  }

  return {
    host: url.hostname,
    port: Number(url.port) || 3306,
    user: decodeURIComponent(url.username),
    password,
    database: decodeURIComponent(url.pathname.replace(/^\//, '')) || 'defaultdb',
    ssl:
      sslMode === 'DISABLED' || sslMode === 'FALSE' || sslMode === '0'
        ? false
        : true,
  };
}

const fromUrl = parseDatabaseUrl(process.env.DATABASE_URL);
const sslOverride = process.env.DB_SSL;

const config = {
  port: Number(process.env.PORT) || 5000,
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    host: fromUrl?.host || process.env.DB_HOST || '127.0.0.1',
    port: fromUrl?.port || Number(process.env.DB_PORT) || 3306,
    user: fromUrl?.user || process.env.DB_USER || 'root',
    password: fromUrl?.password ?? process.env.DB_PASSWORD ?? '',
    // An explicit DB_NAME always wins, so an Aiven URI ending in /defaultdb
    // can still be pointed at the "sms" database without editing the URI.
    database: process.env.DB_NAME || fromUrl?.database || 'sms',
    ssl:
      sslOverride !== undefined && sslOverride !== ''
        ? String(sslOverride).toLowerCase() === 'true'
        : fromUrl
          ? fromUrl.ssl
          : false,
  },
};

if (!process.env.JWT_SECRET) {
  console.warn(
    '[warn] JWT_SECRET is not set. Using an insecure development secret. Set it in server/.env.',
  );
}

module.exports = config;
