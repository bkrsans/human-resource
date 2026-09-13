import { userDataSchema, type UserData } from '../../../shared/schema';

export type Account = {
  id: string;
  email: string;
  name: string;
  organization: string;
  title: string;
  salt: string;
  passwordHash: string;
};

const ACCOUNT_KEY = 'pce:accounts:v1';
const SESSION_KEY = 'pce:session:v1';
const dataKey = (userId: string) => `pce:user:${userId}:data:v1`;

function readAccounts(): Account[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const derived = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 150_000 }, material, 256);
  return bytesToHex(derived);
}

export function passwordStrength(password: string) {
  let score = 0;
  if (password.length >= 10) score++;
  if (password.length >= 14) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^\w\s]/.test(password)) score++;
  return Math.min(score, 4);
}

export async function registerAccount(input: Omit<Account, 'id' | 'salt' | 'passwordHash'> & { password: string }) {
  const email = input.email.trim().toLocaleLowerCase();
  const accounts = readAccounts();
  if (accounts.some((account) => account.email === email)) throw new Error('이미 등록된 이메일입니다.');
  if (passwordStrength(input.password) < 2) throw new Error('비밀번호를 10자 이상으로 만들고 숫자 또는 기호를 포함해 주세요.');
  const salt = crypto.randomUUID();
  const account: Account = {
    id: crypto.randomUUID(), email, name: input.name.trim(), organization: input.organization.trim(), title: input.title.trim(), salt,
    passwordHash: await hashPassword(input.password, salt),
  };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify([...accounts, account]));
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export async function loginAccount(emailValue: string, password: string) {
  const email = emailValue.trim().toLocaleLowerCase();
  const account = readAccounts().find((item) => item.email === email);
  if (!account || (await hashPassword(password, account.salt)) !== account.passwordHash) throw new Error('이메일 또는 비밀번호를 확인해 주세요.');
  localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export async function ensureDemoAccount() {
  const email = 'demo@people.local';
  const existing = readAccounts().find((account) => account.email === email);
  if (existing) { localStorage.setItem(SESSION_KEY, existing.id); return existing; }
  return registerAccount({ email, password: 'Demo!People2026', name: '김프로', organization: 'Project Lab', title: 'People Strategist' });
}

export function currentAccount() {
  const id = localStorage.getItem(SESSION_KEY);
  return id ? readAccounts().find((account) => account.id === id) ?? null : null;
}

export function logoutAccount() { localStorage.removeItem(SESSION_KEY); }

export function updateAccount(userId: string, updates: Pick<Account, 'name' | 'organization' | 'title'>) {
  const accounts = readAccounts();
  const index = accounts.findIndex((account) => account.id === userId);
  if (index < 0) throw new Error('계정을 찾을 수 없습니다.');
  accounts[index] = { ...accounts[index], ...updates };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
  return accounts[index];
}

export async function changePassword(userId: string, currentPassword: string, nextPassword: string) {
  const accounts = readAccounts();
  const index = accounts.findIndex((account) => account.id === userId);
  if (index < 0 || await hashPassword(currentPassword, accounts[index].salt) !== accounts[index].passwordHash) throw new Error('현재 비밀번호가 올바르지 않습니다.');
  if (passwordStrength(nextPassword) < 2) throw new Error('새 비밀번호가 충분히 강하지 않습니다.');
  const salt = crypto.randomUUID();
  accounts[index] = { ...accounts[index], salt, passwordHash: await hashPassword(nextPassword, salt) };
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
}

export function loadUserData(userId: string): { data: UserData; warning?: string } {
  const empty: UserData = { version: 1, networks: [], selectedNetworkId: null };
  const raw = localStorage.getItem(dataKey(userId));
  if (!raw) return { data: empty };
  try {
    const result = userDataSchema.safeParse(JSON.parse(raw));
    return result.success ? { data: result.data } : { data: empty, warning: '저장된 데이터가 손상되어 안전한 빈 공간으로 열었습니다.' };
  } catch {
    return { data: empty, warning: '저장된 데이터를 읽을 수 없어 안전한 빈 공간으로 열었습니다.' };
  }
}

export function saveUserData(userId: string, data: UserData) {
  const validated = userDataSchema.parse(data);
  localStorage.setItem(dataKey(userId), JSON.stringify(validated));
}
