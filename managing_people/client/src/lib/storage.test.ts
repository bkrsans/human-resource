// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { loadUserData, loginAccount, logoutAccount, registerAccount, saveUserData } from './storage';
import type { UserData } from '../../../shared/schema';

describe('account data isolation', () => {
  beforeEach(() => localStorage.clear());

  it('stores a verifier instead of the original password', async () => {
    await registerAccount({ email: 'one@example.com', password: 'Secure!Pass123', name: 'One', organization: 'A', title: 'Lead' });
    const raw = localStorage.getItem('pce:accounts:v1')!;
    expect(raw).not.toContain('Secure!Pass123');
    await expect(loginAccount('one@example.com', 'wrong-password')).rejects.toThrow('이메일 또는 비밀번호');
    await expect(loginAccount('one@example.com', 'Secure!Pass123')).resolves.toMatchObject({ email: 'one@example.com' });
  });

  it('keeps each immutable user id in a separate namespace', async () => {
    const first = await registerAccount({ email: 'one@example.com', password: 'Secure!Pass123', name: 'One', organization: 'A', title: 'Lead' });
    logoutAccount();
    const second = await registerAccount({ email: 'two@example.com', password: 'Secure!Pass456', name: 'Two', organization: 'B', title: 'Lead' });
    const firstData: UserData = { version: 1, networks: [], selectedNetworkId: null };
    const secondData: UserData = { version: 1, networks: [], selectedNetworkId: null };
    saveUserData(first.id, firstData); saveUserData(second.id, secondData);
    expect(Object.keys(localStorage).some((key) => key.includes(first.id))).toBe(true);
    expect(Object.keys(localStorage).some((key) => key.includes(second.id))).toBe(true);
    expect(loadUserData(first.id).data).toEqual(firstData);
  });
});
