// ArcGIS sign-in for the team's page: OAuth 2.0 with PKCE (no client secret, nothing to hide in a public repository).
// The page goes to ArcGIS Online to sign in and comes back with a code, which it exchanges for a token. The token is
// kept for this browser tab only (sessionStorage), and renewed with the refresh token while the tab is open.
import { SETTINGS } from "./settings.js?v=1.0.0";

const KEY = "atlaslabManager.session", PENDING = "atlaslabManager.pending";
const OAUTH = SETTINGS.portal + "/sharing/rest/oauth2";
export const redirectUri = () => location.origin + location.pathname.replace(/index\.html$/, "");

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const random = (n) => b64url(crypto.getRandomValues(new Uint8Array(n)));

export async function signIn() {
  const verifier = random(48), state = random(16);
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  sessionStorage.setItem(PENDING, JSON.stringify({ verifier, state, t: Date.now() }));
  const u = new URL(OAUTH + "/authorize");
  u.search = new URLSearchParams({ client_id: SETTINGS.clientId, response_type: "code", redirect_uri: redirectUri(), code_challenge: challenge, code_challenge_method: "S256", state }).toString();
  location.assign(u.href);
}

async function tokenRequest(params) {
  const r = await fetch(OAUTH + "/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: SETTINGS.clientId, f: "json", ...params }) });
  const j = await r.json();
  if (j.error || !j.access_token) throw new Error((j.error && (j.error.message || j.error_description || j.error)) || "Sign-in failed");
  const s = { token: j.access_token, refresh: j.refresh_token || (current() || {}).refresh || "", username: j.username, expires: Date.now() + (j.expires_in || 1800) * 1000 };
  sessionStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

// After coming back from ArcGIS Online: swaps the code for a token and tidies the address. null if not coming back.
export async function finishSignIn() {
  const q = new URLSearchParams(location.search);
  if (!q.has("code") && !q.has("error")) return null;
  const pending = JSON.parse(sessionStorage.getItem(PENDING) || "null");
  sessionStorage.removeItem(PENDING);
  history.replaceState(null, "", redirectUri());
  if (q.has("error")) throw new Error(q.get("error_description") || q.get("error"));
  if (!pending || pending.state !== q.get("state")) throw new Error("The sign-in didn't come back to the page that started it. Please sign in again.");
  return tokenRequest({ grant_type: "authorization_code", code: q.get("code"), redirect_uri: redirectUri(), code_verifier: pending.verifier });
}

export function current() {
  try { return JSON.parse(sessionStorage.getItem(KEY) || "null"); } catch (e) { return null; }
}
// A token that is good for at least another minute, renewing it if it can.
export async function token() {
  const s = current();
  if (!s) return "";
  if (s.expires - Date.now() > 60000) return s.token;
  if (s.refresh) { try { return (await tokenRequest({ grant_type: "refresh_token", refresh_token: s.refresh })).token; } catch (e) { /* sign in again */ } }
  signOut();
  return "";
}
export function signOut() { sessionStorage.removeItem(KEY); }
