/**
 * 内购（D-218）：单测守卫（docs/revenuecat.md §7.2）+ 纯规则。
 * 每个守卫都先对一段故意写坏的样本跑一遍，证明它真的会变红。
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  addPending,
  backoffMs,
  classifyBuyError,
  EMPTY_FULL_READ,
  fullReadReason,
  leavesPurchaseMark,
  PENDING_MAX,
  PENDING_TTL_MS,
  prunePending,
  readSyncReply,
  type PendingTxn,
} from '@/lib/iap-rules';

const ROOT = path.resolve(__dirname, '..');
const APP_DIRS = ['app', 'components', 'constants', 'content', 'core', 'features', 'lib', 'store'];

function sources(): { file: string; text: string }[] {
  const out: { file: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(name)) out.push({ file: path.relative(ROOT, full).replace(/\\/g, '/'), text: readFileSync(full, 'utf8') });
    }
  };
  for (const d of APP_DIRS) walk(path.join(ROOT, d));
  return out;
}

const importsSdk = (text: string) => /from ['"]react-native-purchases['"]|require\(['"]react-native-purchases['"]\)/.test(text);
const callsLogOut = (text: string) => /\blogOut\s*\(/.test(text);
const secretKey = (text: string) => /\bsk_[A-Za-z0-9]{20,}/.test(text);
function badKeys(purchasesSource: string): string[] {
  const block = purchasesSource.match(/IOS_KEYS[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? '';
  return [...block.matchAll(/:\s*'([^']*)'/g)].map((m) => m[1]).filter((k) => k !== '' && !k.startsWith('appl_'));
}

describe('守卫', () => {
  const src = sources();

  it('只有 lib/purchases.ts 碰 SDK', () => {
    expect(importsSdk("import Purchases from 'react-native-purchases';")).toBe(true);
    expect(src.filter((s) => importsSdk(s.text)).map((s) => s.file)).toEqual(['lib/purchases.ts']);
  });

  it('全库没有 logOut(（换人只 logIn）', () => {
    expect(callsLogOut('await Purchases.logOut();')).toBe(true);
    expect(src.filter((s) => callsLogOut(s.text)).map((s) => s.file)).toEqual([]);
  });

  it('公开 key 只能是空或 appl_ 开头；app 源码里没有 secret key', () => {
    expect(badKeys("const IOS_KEYS: Record<string, string> = {\n  'a.b': 'sk_live_xxx',\n};")).toEqual(['sk_live_xxx']);
    const purchases = src.find((s) => s.file === 'lib/purchases.ts')!.text;
    expect(badKeys(purchases)).toEqual([]);
    expect(secretKey(`const k = 'sk_${'A'.repeat(24)}';`)).toBe(true);
    expect(src.filter((s) => secretKey(s.text)).map((s) => s.file)).toEqual([]);
  });

  it('交给服务器的是购买结果里的苹果交易号，不是 customerInfo 里 RevenueCat 自己的 id', () => {
    const purchases = src.find((s) => s.file === 'lib/purchases.ts')!.text;
    expect(purchases).toContain('r.transaction?.transactionIdentifier');
    expect(src.some((s) => /nonSubscriptionTransactions\[[^\]]*\]\.transactionIdentifier/.test(s.text))).toBe(false);
  });
});

describe('错误码分类：只有确定在付款之前的才不说「可能已扣款」', () => {
  it('取消 / 等批准 / 关了购买 / 付款前', () => {
    expect(classifyBuyError('1')).toBe('cancelled');
    expect(classifyBuyError('20')).toBe('pending-approval');
    expect(classifyBuyError('3')).toBe('not-allowed');
    for (const c of ['5', '11', '23', '32', '35']) expect(classifyBuyError(c)).toBe('before-payment');
  });

  it('其余一律可能已经扣款（网络错误、未知、商店问题、不是 SDK 的错误）', () => {
    for (const c of ['0', '2', '10', '12', '16', null]) expect(classifyBuyError(c)).toBe('maybe-paid');
  });

  it('付款前就结束的不留「24 小时内买过」的标记', () => {
    expect(leavesPurchaseMark('cancelled')).toBe(false);
    expect(leavesPurchaseMark('not-allowed')).toBe(false);
    expect(leavesPurchaseMark('before-payment')).toBe(false);
    expect(leavesPurchaseMark('maybe-paid')).toBe(true);
    expect(leavesPurchaseMark('pending-approval')).toBe(true);
    expect(leavesPurchaseMark('ok')).toBe(true);
  });
});

describe('服务器答复：2xx 不等于有答案', () => {
  it('读得懂的', () => {
    expect(readSyncReply(200, '{"status":"credited"}')).toEqual({ status: 'credited', retryAfterMs: undefined });
    expect(readSyncReply(202, '{"status":"pending","retryAfterMs":3000}')).toEqual({ status: 'pending', retryAfterMs: 3000 });
    expect(readSyncReply(429, '')).toEqual({ status: 'pending', retryAfterMs: 15_000 });
  });
  it('读不全、不是 JSON、没有 status、非 2xx 都算没问到', () => {
    expect(readSyncReply(200, '{"status":"credit')).toBeNull();
    expect(readSyncReply(200, '<html>')).toBeNull();
    expect(readSyncReply(200, '{}')).toBeNull();
    expect(readSyncReply(500, '{"status":"credited"}')).toBeNull();
    expect(readSyncReply(403, '{"error":"not yours"}')).toBeNull();
  });
});

describe('节奏', () => {
  it('没回话按 1、2、4、8 秒退避', () => {
    expect([0, 1, 2, 3, 4, 9].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 8000, 8000]);
  });

  it('手机上留着的交易号：同一笔只留一份、七天后丢、最多 20 笔', () => {
    const NOW = 1_800_000_000_000;
    const p = (i: number, at = NOW): PendingTxn => ({ transactionId: `t${i}`, productId: 'ringring.traffic.s', subscription: false, at });
    let list: PendingTxn[] = [];
    for (let i = 0; i < 25; i++) list = addPending(list, p(i));
    expect(list).toHaveLength(PENDING_MAX);
    expect(list[0].transactionId).toBe('t5');
    expect(addPending([p(1)], p(1)).length).toBe(1);
    expect(prunePending([p(1, NOW - PENDING_TTL_MS - 1), p(2)], NOW).map((x) => x.transactionId)).toEqual(['t2']);
  });

  it('有理由才全量读：一次性购买数变多（至多每 30 秒）、或 24 小时内买过（至多每 10 分钟）', () => {
    const NOW = 1_800_000_000_000;
    expect(fullReadReason(EMPTY_FULL_READ, 0, NOW)).toBeNull();
    expect(fullReadReason(EMPTY_FULL_READ, null, NOW)).toBeNull();
    expect(fullReadReason({ ...EMPTY_FULL_READ, seenCount: 2 }, 3, NOW)).toBe('count');
    expect(fullReadReason({ ...EMPTY_FULL_READ, seenCount: 2, countReadAt: NOW - 10_000 }, 3, NOW)).toBeNull();
    expect(fullReadReason({ ...EMPTY_FULL_READ, purchaseMarkAt: NOW - 3600_000 }, 0, NOW)).toBe('recent');
    expect(fullReadReason({ ...EMPTY_FULL_READ, purchaseMarkAt: NOW - 3600_000, markReadAt: NOW - 60_000 }, 0, NOW)).toBeNull();
    expect(fullReadReason({ ...EMPTY_FULL_READ, purchaseMarkAt: NOW - 25 * 3600_000 }, 0, NOW)).toBeNull();
  });
});
