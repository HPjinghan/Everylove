/**
 * 测试环境（node，无 React Native）：把带原生依赖的模块换成最小桩。
 * - AsyncStorage → 内存实现（zustand persist 与天气缓存用）
 * - react-native / expo-* / react-native-maps → 只提供 import 时会碰到的名字，其余按需返回空组件
 * - constants/theme → 只提供 applyThemeColors 与 themed（store 与卡片样式调）
 * - lib/weather → 固定的天气句（prompt 快照要确定性）
 */
import { vi } from 'vitest';

const mem = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => void mem.set(k, v),
    removeItem: async (k: string) => void mem.delete(k),
    clear: async () => mem.clear(),
  },
}));

/**
 * 任何没列出的导出都给一个空组件（vitest 对 mock 上不存在的导出会报错）。
 * 注意 `then` 必须返回 undefined：mock 模块会被 await，若 then 是函数就成了永远不 resolve 的 thenable。
 */
function stubModule(known: Record<string, unknown>) {
  return new Proxy(known, {
    get: (target, key) => {
      if (typeof key === 'symbol' || key === 'then' || key === '__esModule') return undefined;
      return key in target ? target[key] : () => null;
    },
  });
}

vi.mock('react-native', () =>
  stubModule({
    Platform: { OS: 'ios', select: (o: Record<string, unknown>) => o.ios ?? o.default },
    AppState: { addEventListener: () => ({ remove() {} }) },
    StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1, absoluteFill: {} },
  })
);
vi.mock('react-native-maps', () => stubModule({ default: () => null }));
vi.mock('react-native-url-polyfill/auto', () => ({}));
vi.mock('expo-file-system/legacy', () => stubModule({ documentDirectory: '/tmp/', EncodingType: { Base64: 'base64' } }));
vi.mock('expo-audio', () =>
  stubModule({
    RecordingPresets: { HIGH_QUALITY: { ios: {} } },
    IOSOutputFormat: { LINEARPCM: 'lpcm' },
    AudioQuality: { MAX: 127 },
  })
);
vi.mock('expo-image-manipulator', () => stubModule({ SaveFormat: { JPEG: 'jpeg' } }));
// 分享扩展（D-117）：原生模块，测试里桩掉
vi.mock('expo-share-intent', () =>
  stubModule({
    ShareIntentProvider: ({ children }: { children: unknown }) => children,
    useShareIntentContext: () => ({ hasShareIntent: false, shareIntent: {}, resetShareIntent: () => {} }),
  })
);
// 本地通知（D-114 主动消息排通知）：node 里没有 __DEV__，整个模块桩掉；权限一律拒绝、排通知返回假 id
vi.mock('expo-notifications', () =>
  stubModule({
    setNotificationHandler: () => {},
    getPermissionsAsync: async () => ({ granted: false }),
    requestPermissionsAsync: async () => ({ granted: false }),
    scheduleNotificationAsync: async () => 'notif-1',
    cancelScheduledNotificationAsync: async () => {},
    cancelAllScheduledNotificationsAsync: async () => {},
    SchedulableTriggerInputTypes: { DATE: 'date' },
    IosAuthorizationStatus: { PROVISIONAL: 3 },
  })
);

vi.mock('@/constants/theme', () => ({
  applyThemeColors: () => {},
  applyPaperTint: () => {},
  THEMES: { paper: { label: '纸面', colors: {} } },
  Romance: new Proxy({}, { get: (_t, k) => (typeof k === 'symbol' || k === 'then' ? undefined : '#000000') }),
  Fonts: {},
  themed: (f: () => unknown) => f(),
}));

vi.mock('@/lib/weather', () => ({
  weatherLine: () => '今天多云，22°C',
  todayWeather: () => ({}),
  weatherFor: () => ({}),
  initWeather: async () => {},
  refreshWeather: async () => false,
}));

vi.mock('@/components/toast', () => ({ showToast: () => {} }));

/** 内置立绘表（D-092）require 的是 jpg，node 里加载不了；测试不关心图 */
vi.mock('@/content/portraits', () => ({ SEED_PORTRAITS: {}, seedPortrait: () => undefined }));
