// src/auth.ts
// Minimal Cognito Hosted UI + PKCE client for React

const COGNITO_DOMAIN = "https://us-east-2kgih6ziif.auth.us-east-2.amazoncognito.com";
const CLIENT_ID = "3ahaoavqt9lf07j2btnv26d5dr";
const REDIRECT_URI = "http://localhost:5173/callback";   // must match Cognito app client ** maybe: https://d84l1y8p4kdic.cloudfront.net
const POST_LOGOUT_REDIRECT_URI = "http://localhost:5173/";
const SCOPE = "openid email phone";                       // add 'profile' if you want
const RESPONSE_TYPE = "code";

const STORAGE = {
  codeVerifier: "pkce_code_verifier",
  oauthState: "oauth_state",
  idToken: "id_token",
  accessToken: "access_token",
  refreshToken: "refresh_token",
};

function base64url(uint8: Uint8Array) {
  return btoa(String.fromCharCode(...Array.from(uint8)))
    .replace(/\+/g, "-")
    .replace(/\//g, "-")
    .replace(/=+$/, "");
}

async function sha256(input: string) {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return new Uint8Array(digest);
}

function randomString(length = 64) {
  const charset =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  array.forEach((v) => (result += charset[v % charset.length]));
  return result;
}

export async function login() {
  const codeVerifier = randomString(96);
  const codeChallenge = base64url(await sha256(codeVerifier));
  const state = randomString(24);

  sessionStorage.setItem(STORAGE.codeVerifier, codeVerifier);
  sessionStorage.setItem(STORAGE.oauthState, state);

  const authUrl = new URL(`${COGNITO_DOMAIN}/oauth2/authorize`);
  authUrl.searchParams.set("client_id", CLIENT_ID);
  authUrl.searchParams.set("response_type", RESPONSE_TYPE);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("scope", SCOPE);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  window.location.assign(authUrl.toString());
}

export async function handleCallback(): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const storedState = sessionStorage.getItem(STORAGE.oauthState);
  const codeVerifier = sessionStorage.getItem(STORAGE.codeVerifier);

  if (!code || !state) throw new Error("Missing code/state in callback.");
  if (!storedState || state !== storedState) throw new Error("State mismatch.");
  if (!codeVerifier) throw new Error("Missing PKCE code_verifier.");

  // Exchange code → tokens
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
    code,
    redirect_uri: REDIRECT_URI,
  });

  const resp = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} ${txt}`);
  }

  const json = await resp.json();
  // Save tokens
  localStorage.setItem(STORAGE.idToken, json.id_token);
  localStorage.setItem(STORAGE.accessToken, json.access_token);
  if (json.refresh_token) {
    localStorage.setItem(STORAGE.refreshToken, json.refresh_token);
  }

  // Clean up
  sessionStorage.removeItem(STORAGE.codeVerifier);
  sessionStorage.removeItem(STORAGE.oauthState);

  // Remove ?code=… from the URL
  window.history.replaceState({}, "", "/");
}

export function logout() {
  // Optional: clear local tokens first
  localStorage.removeItem(STORAGE.idToken);
  localStorage.removeItem(STORAGE.accessToken);
  localStorage.removeItem(STORAGE.refreshToken);

  const url = new URL(`${COGNITO_DOMAIN}/logout`);
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("logout_uri", POST_LOGOUT_REDIRECT_URI);
  window.location.assign(url.toString());
}

export function getIdToken(): string | null {
  return localStorage.getItem(STORAGE.idToken);
}

export function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE.accessToken);
}
