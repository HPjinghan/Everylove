/**
 * TA 的周薪（D-128）：钱包没建的建、周薪没估的按人设估一次（模型 → 关键词兜底）、到期的入账（每 7 天一笔，最多补 4 周）。
 * 纯数值与账本在 lib/wallet.ts；这里是启动 / 回前台的任务（features/schedulers.ts 登记）。
 */

import { buildSalarySystem, buildSalaryUser } from '@/content/prompts';
import { completeText } from '@/lib/engine';
import type { Bond, Character } from '@/lib/types';
import { emptyHisWallet, parseSalaryJSON, SALARY_CATCHUP_MAX, SALARY_PERIOD_MS, weeklySalaryFallback } from '@/lib/wallet';
import { findCharacter, useAppStore } from '@/store/app-store';

const inflight = new Set<string>();

/** 周薪没定过就估一次（模型 → 兜底）；只定一次 */
async function ensureSalary(bond: Bond, character: Character): Promise<void> {
  if (bond.wallet?.weekly) return;
  let salary = weeklySalaryFallback(character);
  try {
    const raw = await completeText(buildSalarySystem(), buildSalaryUser(character), 200);
    const parsed = parseSalaryJSON(raw);
    if (parsed) salary = { weekly: parsed.weekly, job: parsed.job || salary.job };
  } catch (e) {
    console.warn('[wallet] 周薪没估成，按关键词兜底：', e);
  }
  useAppStore.getState().patchHisWallet(bond.id, salary);
}

/** 启动 / 回前台：补 TA 的钱包、定周薪、到期的周薪入账（最多补 4 周）；返回入账笔数 */
export async function deliverDueSalaries(now = Date.now()): Promise<number> {
  let paid = 0;
  for (const bond of useAppStore.getState().bonds) {
    const character = findCharacter(bond.characterId);
    if (!character || inflight.has(bond.id)) continue;
    inflight.add(bond.id);
    try {
      if (!bond.wallet) useAppStore.getState().patchHisWallet(bond.id, emptyHisWallet(now));
      const fresh = () => useAppStore.getState().bonds.find((b) => b.id === bond.id)!;
      await ensureSalary(fresh(), character);
      const w = fresh().wallet!;
      if (!w.weekly) continue;
      let last = w.lastSalaryAt ?? now;
      let n = 0;
      while (now - last >= SALARY_PERIOD_MS && n < SALARY_CATCHUP_MAX) {
        last += SALARY_PERIOD_MS;
        n++;
      }
      if (!n) continue;
      for (let i = 0; i < n; i++) useAppStore.getState().adjustHisWallet(bond.id, { amount: w.weekly, kind: 'salary', note: w.job || '工资' });
      // 补太多周就把钟对齐到现在（免得下次又补）
      useAppStore.getState().patchHisWallet(bond.id, { lastSalaryAt: now - last >= SALARY_PERIOD_MS ? now : last });
      paid += n;
    } finally {
      inflight.delete(bond.id);
    }
  }
  return paid;
}

