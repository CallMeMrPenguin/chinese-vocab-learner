'use client';

export interface StoredUserAccount {
  username: string;
  displayName: string;
  saltHex: string;
  passwordHash: string;
  securityQuestion: string;
  securityAnswerHash: string;
  recoveryKeyHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveSession {
  username: string;
  displayName: string;
  sessionToken: string;
  loggedInAt: string;
}

const ACCOUNTS_STORAGE_KEY = 'cvl_user_accounts_v1';
const ACTIVE_SESSION_KEY = 'cvl_active_session_v1';
const LOCKOUT_STORAGE_KEY = 'cvl_auth_lockout_v1';

export const SECURITY_QUESTIONS = [
  'Tên trường cấp 3 của bạn là gì?',
  'Món ăn yêu thích nhất của bạn là gì?',
  'Thành phố nơi bạn sinh ra là gì?',
  'Tên thú cưng đầu tiên của bạn là gì?',
  'Biệt danh thời nhỏ của bạn là gì?',
];

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function generateRecoveryKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = new Uint8Array(8);
  crypto.getRandomValues(rand);
  const part1 = Array.from(rand.slice(0, 4))
    .map((n) => chars[n % chars.length])
    .join('');
  const part2 = Array.from(rand.slice(4, 8))
    .map((n) => chars[n % chars.length])
    .join('');
  return `CVL-${part1}-${part2}`;
}

/**
 * Security Layer 1: PBKDF2-SHA256 (100,000 iterations) Key Derivation
 * Never stores raw passwords, security answers, or recovery keys in plain text.
 */
export async function derivePBKDF2Hash(secret: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(saltHex),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

/**
 * Security Layer 2: Password Policy Check (min 6 chars, contains letters & numbers)
 */
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 6) {
    return 'Mật khẩu phải có ít nhất 6 ký tự.';
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return 'Mật khẩu cần bao gồm cả chữ cái và chữ số.';
  }
  return null;
}

/**
 * Security Layer 3: Brute-force Rate Limiting (Max 5 failed attempts -> 60s lockout)
 */
interface LockoutState {
  failedAttempts: number;
  lockoutUntil: number;
}

function getLockoutState(): LockoutState {
  if (typeof window === 'undefined') return { failedAttempts: 0, lockoutUntil: 0 };
  try {
    const raw = localStorage.getItem(LOCKOUT_STORAGE_KEY);
    if (!raw) return { failedAttempts: 0, lockoutUntil: 0 };
    return JSON.parse(raw);
  } catch {
    return { failedAttempts: 0, lockoutUntil: 0 };
  }
}

export function checkLockoutRemainingSeconds(): number {
  const state = getLockoutState();
  if (!state.lockoutUntil) return 0;
  const diff = Math.ceil((state.lockoutUntil - Date.now()) / 1000);
  if (diff <= 0) {
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
    return 0;
  }
  return diff;
}

function recordFailedAttempt(): { lockedSeconds: number; attemptsLeft: number } {
  const state = getLockoutState();
  const nextAttempts = state.failedAttempts + 1;
  if (nextAttempts >= 5) {
    const lockoutUntil = Date.now() + 60 * 1000;
    localStorage.setItem(
      LOCKOUT_STORAGE_KEY,
      JSON.stringify({ failedAttempts: nextAttempts, lockoutUntil })
    );
    return { lockedSeconds: 60, attemptsLeft: 0 };
  }
  localStorage.setItem(
    LOCKOUT_STORAGE_KEY,
    JSON.stringify({ failedAttempts: nextAttempts, lockoutUntil: 0 })
  );
  return { lockedSeconds: 0, attemptsLeft: 5 - nextAttempts };
}

function clearFailedAttempts(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(LOCKOUT_STORAGE_KEY);
  }
}

function getLocalAccountsMap(): Record<string, StoredUserAccount> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalAccount(account: StoredUserAccount): void {
  if (typeof window === 'undefined') return;
  const map = getLocalAccountsMap();
  map[account.username] = account;
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(map));
}

async function fetchAccountFromCloudOrLocal(username: string): Promise<StoredUserAccount | null> {
  const key = username.trim().toLowerCase();
  const localMap = getLocalAccountsMap();

  try {
    const resp = await fetch(`/api/auth?username=${encodeURIComponent(key)}`, {
      method: 'GET',
      cache: 'no-store',
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data?.enabled && data?.account) {
        saveLocalAccount(data.account);
        return data.account as StoredUserAccount;
      }
    }
  } catch {
    // Fallback to local
  }

  return localMap[key] || null;
}

async function syncAccountToCloud(account: StoredUserAccount): Promise<void> {
  try {
    await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.username, account }),
    });
  } catch {
    // Offline fallback
  }
}

export function getActiveSession(): ActiveSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getActiveUserId(): string {
  const session = getActiveSession();
  return session?.username || 'default_user';
}

function createActiveSession(account: StoredUserAccount): ActiveSession {
  const session: ActiveSession = {
    username: account.username,
    displayName: account.displayName,
    sessionToken: generateSaltHex(24),
    loggedInAt: new Date().toISOString(),
  };
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new Event('cvl-auth-changed'));
  return session;
}

export function logoutUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_SESSION_KEY);
  window.dispatchEvent(new Event('cvl-auth-changed'));
}

/**
 * Register a new user account with PBKDF2-hashed password, security answer, and recovery key
 */
export async function registerUserAccount(params: {
  username: string;
  displayName?: string;
  password: string;
  securityQuestion: string;
  securityAnswer: string;
}): Promise<{
  ok: boolean;
  error?: string;
  recoveryKey?: string;
  session?: ActiveSession;
}> {
  const cleanUser = params.username.trim().toLowerCase();
  if (!cleanUser || cleanUser.length < 3) {
    return { ok: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự.' };
  }
  if (!/^[a-z0-9_.-]+$/.test(cleanUser)) {
    return {
      ok: false,
      error: 'Tên đăng nhập chỉ dùng chữ thường không dấu, số, dấu gạch dưới hoặc dấu chấm.',
    };
  }

  const pwdErr = validatePasswordStrength(params.password);
  if (pwdErr) return { ok: false, error: pwdErr };

  const cleanAnswer = params.securityAnswer.trim().toLowerCase();
  if (cleanAnswer.length < 2) {
    return { ok: false, error: 'Vui lòng nhập câu trả lời bảo mật (ít nhất 2 ký tự).' };
  }

  const existing = await fetchAccountFromCloudOrLocal(cleanUser);
  if (existing) {
    return { ok: false, error: 'Tên đăng nhập này đã tồn tại.' };
  }

  const saltHex = generateSaltHex(16);
  const recoveryKey = generateRecoveryKey();
  const normalizedRecovery = recoveryKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  const [passwordHash, securityAnswerHash, recoveryKeyHash] = await Promise.all([
    derivePBKDF2Hash(params.password, saltHex),
    derivePBKDF2Hash(cleanAnswer, `${saltHex}_sec`),
    derivePBKDF2Hash(normalizedRecovery, `${saltHex}_rec`),
  ]);

  const now = new Date().toISOString();
  const account: StoredUserAccount = {
    username: cleanUser,
    displayName: (params.displayName || params.username).trim(),
    saltHex,
    passwordHash,
    securityQuestion: params.securityQuestion,
    securityAnswerHash,
    recoveryKeyHash,
    createdAt: now,
    updatedAt: now,
  };

  saveLocalAccount(account);
  await syncAccountToCloud(account);
  clearFailedAttempts();
  const session = createActiveSession(account);

  return { ok: true, recoveryKey, session };
}

/**
 * Login with rate-limiting & PBKDF2 verification
 */
export async function loginUserAccount(params: {
  username: string;
  password: string;
}): Promise<{ ok: boolean; error?: string; session?: ActiveSession }> {
  const lockedSec = checkLockoutRemainingSeconds();
  if (lockedSec > 0) {
    return {
      ok: false,
      error: `Tài khoản tạm khóa bảo mật do nhập sai nhiều lần. Vui lòng thử lại sau ${lockedSec} giây.`,
    };
  }

  const cleanUser = params.username.trim().toLowerCase();
  const account = await fetchAccountFromCloudOrLocal(cleanUser);
  if (!account) {
    const fail = recordFailedAttempt();
    return {
      ok: false,
      error:
        fail.lockedSeconds > 0
          ? `Nhập sai quá 5 lần. Khóa tạm thời ${fail.lockedSeconds} giây.`
          : `Tên đăng nhập hoặc mật khẩu không đúng (còn ${fail.attemptsLeft} lần thử).`,
    };
  }

  const candidateHash = await derivePBKDF2Hash(params.password, account.saltHex);
  if (candidateHash !== account.passwordHash) {
    const fail = recordFailedAttempt();
    return {
      ok: false,
      error:
        fail.lockedSeconds > 0
          ? `Nhập sai quá 5 lần. Khóa tạm thời ${fail.lockedSeconds} giây.`
          : `Tên đăng nhập hoặc mật khẩu không đúng (còn ${fail.attemptsLeft} lần thử).`,
    };
  }

  clearFailedAttempts();
  const session = createActiveSession(account);
  return { ok: true, session };
}

/**
 * Lookup account's security question for Forgot Password flow
 */
export async function getAccountSecurityQuestion(
  username: string
): Promise<{ found: boolean; question?: string }> {
  const account = await fetchAccountFromCloudOrLocal(username);
  if (!account) return { found: false };
  return { found: true, question: account.securityQuestion };
}

/**
 * Forgot Password: Reset password using either Security Answer OR Recovery Key
 */
export async function resetPasswordWithRecovery(params: {
  username: string;
  method: 'question' | 'key';
  secretInput: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string; session?: ActiveSession }> {
  const lockedSec = checkLockoutRemainingSeconds();
  if (lockedSec > 0) {
    return {
      ok: false,
      error: `Tạm khóa bảo mật. Vui lòng thử lại sau ${lockedSec} giây.`,
    };
  }

  const pwdErr = validatePasswordStrength(params.newPassword);
  if (pwdErr) return { ok: false, error: pwdErr };

  const cleanUser = params.username.trim().toLowerCase();
  const account = await fetchAccountFromCloudOrLocal(cleanUser);
  if (!account) {
    recordFailedAttempt();
    return { ok: false, error: 'Không tìm thấy tài khoản này.' };
  }

  let verified = false;
  if (params.method === 'question') {
    const cleanAns = params.secretInput.trim().toLowerCase();
    const candidateHash = await derivePBKDF2Hash(cleanAns, `${account.saltHex}_sec`);
    verified = candidateHash === account.securityAnswerHash;
  } else {
    const normalizedKey = params.secretInput.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const candidateHash = await derivePBKDF2Hash(normalizedKey, `${account.saltHex}_rec`);
    verified = candidateHash === account.recoveryKeyHash;
  }

  if (!verified) {
    const fail = recordFailedAttempt();
    return {
      ok: false,
      error:
        fail.lockedSeconds > 0
          ? `Xác thực sai quá 5 lần. Khóa tạm thời ${fail.lockedSeconds} giây.`
          : `${
              params.method === 'question' ? 'Câu trả lời bảo mật' : 'Mã khôi phục'
            } không chính xác (còn ${fail.attemptsLeft} lần thử).`,
    };
  }

  const newPasswordHash = await derivePBKDF2Hash(params.newPassword, account.saltHex);
  const updatedAccount: StoredUserAccount = {
    ...account,
    passwordHash: newPasswordHash,
    updatedAt: new Date().toISOString(),
  };

  saveLocalAccount(updatedAccount);
  await syncAccountToCloud(updatedAccount);
  clearFailedAttempts();
  const session = createActiveSession(updatedAccount);
  return { ok: true, session };
}

/**
 * Change password when already logged in (requires current password verification)
 */
export async function changePasswordLoggedIn(params: {
  username: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean; error?: string }> {
  const pwdErr = validatePasswordStrength(params.newPassword);
  if (pwdErr) return { ok: false, error: pwdErr };

  const account = await fetchAccountFromCloudOrLocal(params.username);
  if (!account) return { ok: false, error: 'Không tìm thấy tài khoản.' };

  const currentHash = await derivePBKDF2Hash(params.currentPassword, account.saltHex);
  if (currentHash !== account.passwordHash) {
    return { ok: false, error: 'Mật khẩu hiện tại không chính xác.' };
  }

  const newHash = await derivePBKDF2Hash(params.newPassword, account.saltHex);
  const updatedAccount: StoredUserAccount = {
    ...account,
    passwordHash: newHash,
    updatedAt: new Date().toISOString(),
  };

  saveLocalAccount(updatedAccount);
  await syncAccountToCloud(updatedAccount);
  return { ok: true };
}
