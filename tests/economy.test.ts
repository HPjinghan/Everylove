/**
 * 服务器记账（D-217）：supabase/functions/_shared/economy.ts 是代理与客户端共用的唯一一份——
 * 钱包视图、生成前的闸门、服务器钱包 → 本机显示缓存。
 */

import { describe, expect, it } from 'vitest';

import { fromServerWallet, mbForUsage, trafficDayKey, voiceLeft } from '@/lib/traffic';
import {
  callAlive,
  CALL_ALIVE_SEC,
  gateReason,
  HOUSE_DAILY_IMAGES,
  HOUSE_DAILY_KTOK,
  HOUSE_DAILY_TTS_SEC,
  mbFor,
  sqlEconomy,
  walletView,
  type WalletRow,
} from '@/supabase/functions/_shared/economy';

const NOW = Date.UTC(2026, 9, 21, 3, 0, 0);

const row = (over: Partial<WalletRow> = {}): WalletRow => ({
  plan: 'free',
  balance_mb: 0,
  free_used_mb: 0,
  voice_used_sec: 0,
  voice_pack_sec: 0,
  call_bonus_sec: 300,
  house_ktok: 0,
  house_images: 0,
  house_tts_sec: 0,
  call_tick_at: null,
  ...over,
});

describe('钱包视图', () => {
  it('今天免费的还剩 = 100 − 用掉的；语音额度按档位；数字串也认（PostgREST 的 numeric）', () => {
    const v = walletView(row({ plan: 'pro', free_used_mb: '30.5' as unknown as number, voice_used_sec: 600, balance_mb: 6000 }), false);
    expect(v).toEqual({ plan: 'pro', balance: 6000, freeLeft: 69.5, voiceDailyLeft: 1200, packSec: 0, callBonusSec: 300, live: false });
    expect(walletView(row({ free_used_mb: 140 }), true).freeLeft).toBe(0);
  });
});

describe('生成前的闸门（服务器照它拦）', () => {
  const gate = (w: WalletRow, kind: Parameters<typeof gateReason>[2], billing: Parameters<typeof gateReason>[3]) => gateReason(w, walletView(w, false), kind, billing);

  it('她发起的：免费的 + 余额还有就放行；Max 不限', () => {
    expect(gate(row(), 'chat', 'user')).toBeNull();
    expect(gate(row({ free_used_mb: 100 }), 'chat', 'user')).toBe('traffic');
    expect(gate(row({ free_used_mb: 100, balance_mb: 0.2 }), 'image', 'user')).toBeNull();
    expect(gate(row({ plan: 'max', free_used_mb: 100 }), 'vision', 'user')).toBeNull();
  });

  it('TA 的语音看语音时长：Free 没有，送的通话只能打电话', () => {
    expect(gate(row(), 'tts', 'user')).toBe('voice');
    expect(gate(row({ voice_pack_sec: 60 }), 'tts', 'user')).toBeNull();
    expect(gate(row({ plan: 'pro' }), 'tts', 'user')).toBeNull();
    expect(gate(row(), 'chat', 'included')).toBeNull();
    expect(gate(row({ call_bonus_sec: 0 }), 'chat', 'included')).toBe('voice');
  });

  it('平台出的只受保险丝管', () => {
    expect(gate(row({ free_used_mb: 100 }), 'chat', 'house')).toBeNull();
    expect(gate(row({ house_ktok: HOUSE_DAILY_KTOK }), 'chat', 'house')).toBe('house');
    expect(gate(row({ house_images: HOUSE_DAILY_IMAGES }), 'image', 'house')).toBe('house');
    expect(gate(row({ house_tts_sec: HOUSE_DAILY_TTS_SEC }), 'tts', 'house')).toBe('house');
    expect(gate(row({ house_ktok: HOUSE_DAILY_KTOK }), 'asr', 'house')).toBeNull();
  });

  it('通话还在不在按上一次计时', () => {
    expect(callAlive(row(), NOW)).toBe(false);
    expect(callAlive(row({ call_tick_at: new Date(NOW - 10_000).toISOString() }), NOW)).toBe(true);
    expect(callAlive(row({ call_tick_at: new Date(NOW - (CALL_ALIVE_SEC + 1) * 1000).toISOString() }), NOW)).toBe(false);
  });
});

describe('换算：客户端与服务端同一个 mbFor', () => {
  it('聊天按 token、生图按张或 token、看图按件、识别按秒、TA 的语音不折流量', () => {
    expect(mbForUsage({ kind: 'chat', provider: 'anthropic', inputTokens: 1500, outputTokens: 500 })).toBe(mbFor({ kind: 'chat', tokens: 2000 }));
    expect(mbFor({ kind: 'chat', tokens: 2000 })).toBe(2);
    expect(mbFor({ kind: 'image', images: 2 })).toBe(30);
    expect(mbFor({ kind: 'image', outputTokens: 4000 })).toBe(12);
    expect(mbFor({ kind: 'vision' })).toBe(3);
    expect(mbFor({ kind: 'asr', seconds: 1 })).toBe(0.1);
    expect(mbFor({ kind: 'asr', seconds: 90 })).toBe(1.5);
    expect(mbFor({ kind: 'tts', seconds: 30 })).toBe(0);
  });

  it('传给 SQL 的数值', () => {
    expect(sqlEconomy()).toMatchObject({ daily_free_mb: 100, pro_monthly_mb: 6000, new_user_call_sec: 300, voice_daily_sec: { free: 0, pro: 1800, max: 5400 } });
  });
});

describe('服务器钱包 → 本机显示缓存', () => {
  it('换成 store 的形状，本机闸门读出来和服务器一样', () => {
    const v = walletView(row({ plan: 'pro', free_used_mb: 40, balance_mb: 120, voice_used_sec: 300, voice_pack_sec: 600, call_bonus_sec: 120 }), false);
    const w = fromServerWallet(v, NOW);
    expect(w.plan).toBe('pro');
    expect(w.traffic).toEqual({ balance: 120, freeDay: trafficDayKey(NOW), freeUsed: 40 });
    expect(voiceLeft(w.voice, 'pro', 'message', NOW)).toBe(1500 + 600);
    expect(voiceLeft(w.voice, 'pro', 'call', NOW)).toBe(1500 + 600 + 120);
  });
});
