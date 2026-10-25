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
  MAX_DAILY_IMAGES,
  MAX_IMAGE_GAP_SEC,
  MAX_SLOW_IMAGES,
  costTokens,
  mbFor,
  slowLaneOf,
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
  fair_ktok: 0,
  fair_images: 0,
  call_tick_at: null,
  ...over,
});

describe('钱包视图', () => {
  it('今天免费的还剩 = 100 − 用掉的；流量能换几秒 TA 的声音（Free 0）；数字串也认（PostgREST 的 numeric）', () => {
    const v = walletView(row({ plan: 'pro', free_used_mb: '30.5' as unknown as number, voice_used_sec: 600, balance_mb: 6000 }), false);
    // (69.5 + 6000) RB ÷ 20 RB / 分钟 × 60
    expect(v).toEqual({ plan: 'pro', balance: 6000, freeLeft: 69.5, voiceDailyLeft: 18208, packSec: 0, callBonusSec: 300, live: false });
    expect(walletView(row({ plan: 'free', balance_mb: 6000 }), false).voiceDailyLeft).toBe(0);
    expect(walletView(row({ free_used_mb: 140 }), true).freeLeft).toBe(0);
  });
});

describe('生成前的闸门（服务器照它拦）', () => {
  const gate = (w: WalletRow, kind: Parameters<typeof gateReason>[2], billing: Parameters<typeof gateReason>[3]) => gateReason(w, walletView(w, false), kind, billing);

  it('她发起的：免费的 + 余额还有就放行；Max 也看余额（D-236）；TA 的语音 Free 不能用流量换', () => {
    expect(gate(row(), 'chat', 'user')).toBeNull();
    expect(gate(row({ free_used_mb: 100 }), 'chat', 'user')).toBe('traffic');
    expect(gate(row({ free_used_mb: 100, balance_mb: 0.2 }), 'image', 'user')).toBeNull();
    expect(gate(row({ plan: 'max', free_used_mb: 100 }), 'vision', 'user')).toBe('traffic');
    expect(gate(row({ plan: 'max', free_used_mb: 100, balance_mb: 50 }), 'vision', 'user')).toBeNull();
    expect(gate(row({ plan: 'free' }), 'tts', 'user')).toBe('voice');
    expect(gate(row({ plan: 'pro' }), 'tts', 'user')).toBeNull();
  });

  it('Max 过线降速不拦（D-220）：聊天 3000 千 token 起隔 15 秒、6000 起隔 60 秒；生图 31 张起 5 分钟一张、61 张起当天停', () => {
    const max = (over: Partial<WalletRow>) => row({ plan: 'max', ...over });
    expect(gate(max({ fair_ktok: 99999 }), 'chat', 'user')).toBeNull();
    expect(slowLaneOf(max({ fair_ktok: 2999 }), 'chat', 'user')).toBeNull();
    expect(slowLaneOf(max({ fair_ktok: 3000 }), 'chat', 'user')).toMatchObject({ lane: 'chat', gapSec: 15 });
    expect(slowLaneOf(max({ fair_ktok: 6000 }), 'vision', 'user')).toMatchObject({ lane: 'chat', gapSec: 60 });
    expect(slowLaneOf(max({ fair_images: MAX_SLOW_IMAGES - 1 }), 'image', 'user')).toBeNull();
    expect(slowLaneOf(max({ fair_images: MAX_SLOW_IMAGES }), 'image', 'user')).toMatchObject({ lane: 'image', gapSec: MAX_IMAGE_GAP_SEC });
    expect(gate(max({ fair_images: MAX_DAILY_IMAGES - 1 }), 'image', 'user')).toBeNull();
    expect(gate(max({ fair_images: MAX_DAILY_IMAGES }), 'image', 'user')).toBe('fair');
    // 只管 Max 她发起的：平台出的、别的档、识别与 TA 的声音都不降速
    expect(slowLaneOf(max({ fair_ktok: 9999 }), 'chat', 'house')).toBeNull();
    expect(slowLaneOf(max({ fair_ktok: 9999 }), 'asr', 'user')).toBeNull();
    expect(slowLaneOf(row({ plan: 'pro', balance_mb: 50, fair_ktok: 9999, fair_images: 99 }), 'image', 'user')).toBeNull();
    expect(gate(row({ plan: 'pro', balance_mb: 50, fair_images: 99 }), 'image', 'user')).toBeNull();
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
    expect(gate(row({ house_images: HOUSE_DAILY_IMAGES.free }), 'image', 'house')).toBe('house');
    // TA 主动发图按档位（D-219）：Free 1 / Pro 4 / Max 8
    expect(gate(row({ plan: 'pro', house_images: 1 }), 'image', 'house')).toBeNull();
    expect(gate(row({ plan: 'pro', house_images: 2 }), 'image', 'house')).toBe('house');
    expect(gate(row({ plan: 'max', house_images: 2 }), 'image', 'house')).toBeNull();
    expect(gate(row({ plan: 'max', house_images: 3 }), 'image', 'house')).toBe('house');
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
  it('聊天按 token、生图按张（qwen 60 / 动漫 50）、看图按件、识别按秒、TA 的语音每分钟 20', () => {
    expect(mbForUsage({ kind: 'chat', provider: 'anthropic', inputTokens: 1500, outputTokens: 500 })).toBe(mbFor({ kind: 'chat', tokens: 4000 }));
    // D-233：缓存住的前缀也算，按价目比折（实测一轮：没命中 4、缓存读 3512、缓存写 24、输出 11 → 440 当量）
    expect(costTokens({ input: 4, cacheRead: 3512, cacheWrite: 24, output: 11 })).toBe(440);
    expect(mbForUsage({ kind: 'chat', provider: 'anthropic', inputTokens: 4, cacheReadTokens: 3512, cacheWriteTokens: 24, outputTokens: 11 })).toBe(0.44);
    expect(mbFor({ kind: 'chat', tokens: 2000 })).toBe(2);
    expect(mbFor({ kind: 'image', images: 2 })).toBe(120);
    expect(mbFor({ kind: 'image' })).toBe(60);
    expect(mbFor({ kind: 'image', model: 'muse' })).toBe(50);
    expect(mbFor({ kind: 'vision' })).toBe(3);
    expect(mbFor({ kind: 'asr', seconds: 1 })).toBe(0.1);
    expect(mbFor({ kind: 'asr', seconds: 90 })).toBe(3);
    expect(mbFor({ kind: 'tts', seconds: 30 })).toBe(10);
  });

  it('传给 SQL 的数值', () => {
    expect(sqlEconomy()).toMatchObject({
      daily_free_mb: 100,
      pro_monthly_mb: 8000,
      plan_monthly_mb: { free: 0, pro: 8000, max: 30000 },
      voice_mb_per_min: 20,
      new_user_call_sec: 300,
    });
  });
});

describe('服务器钱包 → 本机显示缓存', () => {
  it('换成 store 的形状，本机闸门读出来和服务器一样', () => {
    const v = walletView(row({ plan: 'pro', free_used_mb: 40, balance_mb: 120, voice_used_sec: 300, voice_pack_sec: 600, call_bonus_sec: 120 }), false);
    const w = fromServerWallet(v, NOW);
    expect(w.plan).toBe('pro');
    expect(w.traffic).toEqual({ balance: 120, freeDay: trafficDayKey(NOW), freeUsed: 40 });
    // 流量 (100 − 40) + 120 = 180 RB → 540 秒，加老分钟包 600 秒；电话再加送的 120 秒
    expect(voiceLeft(w.voice, w.traffic, 'pro', 'message', NOW)).toBe(540 + 600);
    expect(voiceLeft(w.voice, w.traffic, 'pro', 'call', NOW)).toBe(540 + 600 + 120);
  });
});
