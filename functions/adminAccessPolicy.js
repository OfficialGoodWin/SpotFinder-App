const ADMIN_EMAIL = 'redm3467@gmail.com';
const ADMIN_WINDOW_SECONDS = 30 * 60;

function adminSessionSeconds(token, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (token?.admin !== true || token?.email?.toLowerCase() !== ADMIN_EMAIL
    || token?.email_verified !== true || token?.firebase?.sign_in_provider !== 'google.com'
    || token?.firebase?.sign_in_second_factor !== 'totp') return 0;
  const authTime = Number(token.auth_time);
  if (!Number.isFinite(authTime) || authTime > nowSeconds) return 0;
  return Math.max(0, ADMIN_WINDOW_SECONDS - (nowSeconds - authTime));
}

module.exports = { ADMIN_EMAIL, ADMIN_WINDOW_SECONDS, adminSessionSeconds };
