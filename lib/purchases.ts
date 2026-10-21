/**
 * RevenueCat SDK 的唯一入口（D-218）：全工程只有这个文件 import react-native-purchases（tests/iap.test.ts 守着）。
 * 流程与坑见 docs/revenuecat.md（「第 n 条」指它）：
 * - 公开 key 写成代码常量、按打包时的 bundle id 选，不放 .env（第 31 条：热更脚本会剥掉 EXPO_PUBLIC_*）；secret key 只在服务器。
 * - App User ID 只用服务器发的随机 UUID（第 1 条）；换人只 logIn、永远不调 logOut（第 2 条）；身份变更排成一个队（第 3 条）。
 * - Expo Go 没有原生模块（SDK 会进预览模式假装能买）、没填 key、没装原生模块的旧包 → purchasesSupported() 为假，付费入口换成「下个版本开放」。
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import { NativeModules } from 'react-native';
import Purchases, { type PurchasesError, type PurchasesPackage } from 'react-native-purchases';

/** 公开的 iOS key（appl_ 开头，本来就在包里）：按 bundle id 选；空 = 这个包不开内购 */
const IOS_KEYS: Record<string, string> = {
  'com.biibit.ringring': '',
};

function apiKey(): string {
  const bundle = Constants.expoConfig?.ios?.bundleIdentifier ?? '';
  return IOS_KEYS[bundle] ?? '';
}

/** 这个包能不能真买：有原生模块、不在 Expo Go、填了 key */
export function purchasesSupported(): boolean {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  if (!NativeModules.RNPurchases) return false;
  return apiKey().startsWith('appl_');
}

/* ── 身份：串行队列，只 configure / logIn，永不 logOut ── */

let queue: Promise<unknown> = Promise.resolve();
let configured = false;

/** 让 SDK 停在这个 App User ID 上；返回是否已经在了 */
export function identifyPurchases(appUserId: string): Promise<boolean> {
  const run = async (): Promise<boolean> => {
    if (!purchasesSupported()) return false;
    // JS 重载（热更新被应用）之后原生 SDK 仍是配置好的：先问，没配置才 configure（第 5 条）
    if (!configured) configured = await Purchases.isConfigured().catch(() => false);
    if (!configured) {
      Purchases.configure({ apiKey: apiKey(), appUserID: appUserId });
      configured = true;
      return true;
    }
    if ((await Purchases.getAppUserID()) !== appUserId) await Purchases.logIn(appUserId);
    return (await Purchases.getAppUserID()) === appUserId;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}

/** SDK 现在停在谁身上（没配置 = null） */
export async function currentAppUserId(): Promise<string | null> {
  if (!configured || !purchasesSupported()) return null;
  return Purchases.getAppUserID().catch(() => null);
}

/* ── 商品 ── */

export interface StorePackage {
  /** App Store 商品 ID（和服务器商品表对的就是它） */
  productId: string;
  /** StoreKit 给的本地价格字符串（第 28 条：永不写死） */
  priceString: string;
  subscription: boolean;
  pkg: PurchasesPackage;
}

/** 当前 offering 里的包（没配置 / 读不到 = 空） */
export async function loadPackages(): Promise<StorePackage[]> {
  if (!configured || !purchasesSupported()) return [];
  const offerings = await Purchases.getOfferings();
  return (offerings.current?.availablePackages ?? []).map((pkg) => ({
    productId: pkg.product.identifier,
    priceString: pkg.product.priceString,
    subscription: pkg.product.productCategory === 'SUBSCRIPTION',
    pkg,
  }));
}

/* ── 购买 ── */

export interface BuyResult {
  /** 苹果的交易号（购买结果里的 transaction.transactionIdentifier，第 21 条；不是 customerInfo 里 RevenueCat 自己的 id） */
  transactionId: string | null;
  productId: string;
}

/** 买一个包：打开苹果面板之前再核一次 SDK 在谁身上（第 4 条），对不上就不开 */
export async function buyPackage(p: StorePackage, expectAppUserId: string): Promise<BuyResult> {
  if ((await currentAppUserId()) !== expectAppUserId) throw new IdentityMismatchError();
  const r = await Purchases.purchasePackage(p.pkg);
  return { transactionId: r.transaction?.transactionIdentifier ?? null, productId: r.productIdentifier };
}

/** 恢复购买（订阅必须有，第 30 条 / §10） */
export async function restorePurchases(): Promise<void> {
  if (!configured || !purchasesSupported()) return;
  await Purchases.restorePurchases();
}

/** RevenueCat 记着的一次性购买数（判断「有没有新购买」用；最多等 2 秒，第 26 条） */
export async function oneTimePurchaseCount(): Promise<number | null> {
  if (!configured || !purchasesSupported()) return null;
  const read = Purchases.getCustomerInfo().then((c) => c.nonSubscriptionTransactions.length);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
  return Promise.race([read, timeout]).catch(() => null);
}

/** 客户信息变了（家长批准的购买、别处的恢复）：通知一声，由 features/iap 去问服务器 */
export function onPurchasesChanged(fn: () => void): void {
  if (!purchasesSupported()) return;
  Purchases.addCustomerInfoUpdateListener(() => fn());
}

/** SDK 的错误码（字符串）；不是 SDK 的错误 = null */
export function purchaseErrorCode(e: unknown): string | null {
  const code = (e as Partial<PurchasesError> | null)?.code;
  return typeof code === 'string' ? code : null;
}

export class IdentityMismatchError extends Error {
  constructor() {
    super('purchases identity mismatch');
    this.name = 'IdentityMismatchError';
  }
}
