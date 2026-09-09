/**
 * 给种子角色生成立绘并打进包里（D-092）：所有人打开 App，原始角色默认就有形象。（.mts：顶层 await 要 ESM）
 *   node --import tsx scripts/gen-seed-portraits.mts            # 缺哪个补哪个
 *   node --import tsx scripts/gen-seed-portraits.mts --force     # 全部重画
 *   node --import tsx scripts/gen-seed-portraits.mts --only shen-zhiyan,hu-bugui
 * prompt 与 App 内完全一致（content/prompts/portrait.ts 的 buildPortraitPrompt，模型按画风 imageModelFor）；
 * 出图先落 scripts/out/（含参数与完整 prompt），再拷到 assets/portraits/<id>.jpg——content/portraits.ts 按 id require。
 * key 读 .env.local 的 EXPO_PUBLIC_QIANFAN_API_KEY（gen-image-core 同一套）。
 * 千帆文生图按分钟限频（RPM）：默认串行，撞到 429 等一会儿重试。
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { CHARACTERS } from '@/content/characters';
import { buildPortraitPrompt, imageModelFor, PORTRAIT_NEGATIVE } from '@/content/prompts/portrait';

// @ts-expect-error 纯 JS 工具模块，没有类型声明
import { generate, ROOT } from './gen-image-core.mjs';

const OUT_DIR = resolve(ROOT as string, 'assets/portraits');
const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyArg = args[args.indexOf('--only') + 1];
const only = args.includes('--only') && onlyArg ? new Set(onlyArg.split(',')) : null;
const concurrency = Number(args[args.indexOf('--concurrency') + 1]) || 1;
const RETRY_WAIT_MS = 25_000;
const MAX_TRIES = 4;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

mkdirSync(OUT_DIR, { recursive: true });

// 本地化种子（-en / -ja / -ko）共用中文原 id 的立绘（content/portraits.ts seedBaseId），只画六位原版
const targets = CHARACTERS.filter((c) => !c.teaser && !/-(en|ja|ko)$/.test(c.id))
  .filter((c) => !only || only.has(c.id))
  .filter((c) => force || !existsSync(resolve(OUT_DIR, `${c.id}.jpg`)));

if (!targets.length) {
  console.log('没有需要生成的角色（已全部存在；重画加 --force）');
  process.exit(0);
}
console.log(`要画 ${targets.length} 位：${targets.map((c) => c.name).join('、')}`);

async function one(c: (typeof CHARACTERS)[number]) {
  const prompt = buildPortraitPrompt(c);
  const model = imageModelFor(c);
  const t0 = Date.now();
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    try {
      const r = (await generate({
        prompt,
        model,
        negative: PORTRAIT_NEGATIVE,
        meta: { seedCharacter: c.id, style: c.artStyle ?? 'shojo' },
      })) as {
        files: string[];
        elapsed: number;
      };
      copyFileSync(r.files[0], resolve(OUT_DIR, `${c.id}.jpg`));
      console.log(`✓ ${c.name}（${c.id}）${model} ${r.elapsed.toFixed(1)}s → assets/portraits/${c.id}.jpg`);
      return;
    } catch (e) {
      const err = e as { message?: string; body?: string; status?: number };
      const limited = err.status === 429;
      console.error(
        `✗ ${c.name}（${c.id}）第 ${attempt} 次失败 ${((Date.now() - t0) / 1000).toFixed(1)}s：${err.message}` +
          (err.body ? ` ${String(err.body).slice(0, 160)}` : '')
      );
      if (!limited || attempt === MAX_TRIES) {
        process.exitCode = 1;
        return;
      }
      console.log(`  限频，等 ${RETRY_WAIT_MS / 1000}s 再试…`);
      await sleep(RETRY_WAIT_MS);
    }
  }
}

for (let i = 0; i < targets.length; i += concurrency) {
  await Promise.all(targets.slice(i, i + concurrency).map(one));
}
console.log('完成');
