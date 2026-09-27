/**
 * 音频会话（D-195）：iOS 的 AVAudioSession 类别由这里统一切，别处不直接调 setAudioModeAsync。
 * expo-audio 的原生默认是 ambient（静音键一拨就没声），所以：
 * - playback：TA 的语音条、她的语音回放、音色试听——playback 类别，无视静音键、出扬声器；别的 App 在放的音乐压低（duckOthers），放完恢复。
 *   启动就切到这一档，之后每次播放前再确认一次（录音 / 通话会切走）。
 * - record：她录语音——playAndRecord。
 * - call：打电话——playAndRecord 走听筒（像真的电话）；免提 = playback 出扬声器（D-091）；独占（doNotMix），通话时别的声音停。
 * 全部无视静音键：这是通话与语音消息，不是背景音乐。
 */

import { setAudioModeAsync } from 'expo-audio';

async function apply(mode: Parameters<typeof setAudioModeAsync>[0]): Promise<void> {
  try {
    await setAudioModeAsync(mode);
  } catch (e) {
    console.warn('[audio] 切音频会话失败：', e);
  }
}

export const audioSession = {
  /** 播放语音条 / 试听：无视静音键，出扬声器，压低别的 App */
  playback: () => apply({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers', shouldPlayInBackground: false }),
  /** 录语音 */
  record: () => apply({ playsInSilentMode: true, allowsRecording: true, interruptionMode: 'doNotMix', shouldPlayInBackground: false }),
  /** 通话：听筒（speaker = false）或免提 */
  call: (speaker: boolean) =>
    apply({ playsInSilentMode: true, allowsRecording: !speaker, interruptionMode: 'doNotMix', shouldPlayInBackground: false }),
};
