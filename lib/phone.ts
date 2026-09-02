/**
 * TA 的手机密码（D-082）：查手机第一次要先拿到密码——在聊天里问 TA（TA 答应就解锁），或在锁屏上自己猜（猜对就开）。
 * 密码**随机**：第一次需要时（她第一次问 / 第一次点开锁屏）生成 4 位并记在这段羁绊上（`Bond.phoneCode`，
 * store.ensurePhoneCode），之后 TA 的 prompt 与锁屏共用同一把；解锁后 `Bond.phoneUnlocked`。
 */

export const PHONE_PASSCODE_LENGTH = 4;

/** 四位随机数字（允许前导 0，像真的锁屏密码） */
export function randomPasscode(): string {
  let s = '';
  for (let i = 0; i < PHONE_PASSCODE_LENGTH; i++) s += Math.floor(Math.random() * 10);
  return s;
}
