/**
 * 音色池（D-139 / D-230）：TA 的声音只从 Fish Audio 官方账号（Fish Official）自己的声线里选——
 * 社区上传的声线大量克隆真人 / IP 角色（红线 1），一把都不收；官方声线是虚构人名、Fish 自己出的。
 * 每把声线标它是哪几种恋爱类型的默认声（styles = LOVE_STYLES 的 label，同语言同性别里每种类型恰好一把）；
 * 选法：每把声线的试听样音实测音高 / 起伏 / 语速，加 Fish 的描述，人工定（scripts/fish-voices.mjs 拉候选）。
 * 创造页按类型推荐、可换一批；角色没选 = 按恋爱类型取这里的默认（lib/speech defaultVoiceId）。
 * 排除：童声感的（日语 陽菜 Hina）、客服 / 播音腔为主的、英语里非美英口音的（目标市场是美国）。
 */

import type { Lang } from '@/lib/i18n';

export interface VoiceOption {
  /** Fish Audio reference_id */
  id: string;
  /** 声线名（显示用，各语言自己的名字） */
  name: string;
  lang: Lang;
  gender: 'male' | 'female' | 'nonbinary';
  /** 这把是哪几种恋爱类型的默认声（LOVE_STYLES 的 label；显示时 t()） */
  styles: string[];
}

export const VOICES: VoiceOption[] = [
  // zh · 男
  { id: 'fdc29e5149ea49c7b21c2556c5f05ce2', name: '建国', lang: 'zh', gender: 'male', styles: ['温柔年上', '姐姐系', '冷静大人'] },
  { id: 'e7af89da8abc4fbdacd9a10ab9881933', name: '家豪', lang: 'zh', gender: 'male', styles: ['小狗系年下', '天然治愈'] },
  { id: 'd675c275d1d44e57b4ef3840c5a23209', name: '浩然', lang: 'zh', gender: 'male', styles: ['依恋型', '病娇（尺度内）'] },
  { id: 'e27c0811319145f7832b3c3508401ea5', name: '柏翰', lang: 'zh', gender: 'male', styles: ['阳光直球', '傲娇'] },
  { id: '1e85fd1e0d3e4cc2b79fbca800e7e3fe', name: '承翰', lang: 'zh', gender: 'male', styles: ['青梅竹马', '毒舌竹马'] },
  { id: '5d29a99739c14d4ca3e4fe42193105b2', name: '梓轩', lang: 'zh', gender: 'male', styles: ['腹黑', '高冷禁欲', '霸总'] },
  // zh · 女
  { id: 'ebfc2bf5a84747bab0bfcba1a6c63f79', name: '雨薇', lang: 'zh', gender: 'female', styles: ['温柔年上', '依恋型', '病娇（尺度内）'] },
  { id: 'e98fa6cdad6946bf8d9bb8f9cb8c2532', name: '冰冰', lang: 'zh', gender: 'female', styles: ['小狗系年下', '傲娇'] },
  { id: '49066cb45f0a427484ade915a4474534', name: '雅婷', lang: 'zh', gender: 'female', styles: ['姐姐系', '天然治愈'] },
  { id: '8b1b2413e55e495f82471aa2248561c3', name: '晓彤', lang: 'zh', gender: 'female', styles: ['阳光直球', '青梅竹马'] },
  { id: '91ec588cf8ef443a9c0d5b21d0c1fa36', name: '詩涵', lang: 'zh', gender: 'female', styles: ['毒舌竹马', '霸总'] },
  { id: '74c6aba5cbf94a15bbdc547ffce5cb38', name: '语彤', lang: 'zh', gender: 'female', styles: ['腹黑', '高冷禁欲', '冷静大人'] },
  // en · 男
  { id: '1f97ab64476c4e468a0888ae22954dab', name: 'Hugo', lang: 'en', gender: 'male', styles: ['温柔年上'] },
  { id: '0db6e93af420470b9d9b9a886dbaa954', name: 'Kai', lang: 'en', gender: 'male', styles: ['小狗系年下'] },
  { id: '8634617958764b539e0cdd5eb6c7723e', name: 'Wesley', lang: 'en', gender: 'male', styles: ['姐姐系'] },
  { id: '89fe13ec21f54e40920c9a9c089d5ff3', name: 'Milo', lang: 'en', gender: 'male', styles: ['依恋型'] },
  { id: 'f663fef9788d4ac0a6bfe36f1b3c871f', name: 'Cody', lang: 'en', gender: 'male', styles: ['阳光直球'] },
  { id: '732ea755bd9e446eb31dc79966b50428', name: 'Beau', lang: 'en', gender: 'male', styles: ['天然治愈'] },
  { id: 'f983ef416c87413f986e1a5a000c385e', name: 'Miles', lang: 'en', gender: 'male', styles: ['青梅竹马'] },
  { id: '9fa4b7a1b67446b48208f2f5d4bcd8da', name: 'Dax', lang: 'en', gender: 'male', styles: ['毒舌竹马'] },
  { id: '08b4100b4c3747fe84ed8b57d26a95ba', name: 'James', lang: 'en', gender: 'male', styles: ['傲娇'] },
  { id: '8451cb6e7e204684973f172cc616ec20', name: 'Jonah', lang: 'en', gender: 'male', styles: ['腹黑'] },
  { id: 'db6abd0e4d5544e4ac75d777d90b9a35', name: 'Theo', lang: 'en', gender: 'male', styles: ['病娇（尺度内）'] },
  { id: 'f83f2e43d24b4bccb3bd3a63a950aa93', name: 'Rupert', lang: 'en', gender: 'male', styles: ['高冷禁欲'] },
  { id: 'bf322df2096a46f18c579d0baa36f41d', name: 'Adrian', lang: 'en', gender: 'male', styles: ['霸总'] },
  { id: '536d3a5e000945adb7038665781a4aca', name: 'Ethan', lang: 'en', gender: 'male', styles: ['冷静大人'] },
  // en · 女
  { id: 'b347db033a6549378b48d00acb0d06cd', name: 'Selene', lang: 'en', gender: 'female', styles: ['温柔年上'] },
  { id: 'f3a2b90078d54a65af4b95f63bc7798e', name: 'Sheila', lang: 'en', gender: 'female', styles: ['小狗系年下'] },
  { id: 'e3cd384158934cc9a01029cd7d278634', name: 'Laura', lang: 'en', gender: 'female', styles: ['姐姐系'] },
  { id: '933563129e564b19a115bedd57b7406a', name: 'Sarah', lang: 'en', gender: 'female', styles: ['依恋型'] },
  { id: '1dc966a13a564043ae15591f997a3144', name: 'Sabrina', lang: 'en', gender: 'female', styles: ['阳光直球'] },
  { id: '606aa33cd0964bbeaddd77071e4ec8b8', name: 'Kendall', lang: 'en', gender: 'female', styles: ['天然治愈'] },
  { id: '705690224f264386b87fb598083ab022', name: 'Megan', lang: 'en', gender: 'female', styles: ['青梅竹马'] },
  { id: 'c70cfb98867a4bfb9ae20d2401257b92', name: 'Delia', lang: 'en', gender: 'female', styles: ['毒舌竹马'] },
  { id: '04a767f405104eb7afa1a7e80f60bd1b', name: 'Iris', lang: 'en', gender: 'female', styles: ['傲娇'] },
  { id: 'f493c40876fc4d5ab28daf77efb0e686', name: 'Jennifer', lang: 'en', gender: 'female', styles: ['腹黑'] },
  { id: '4f14b263c4ee418b9193de6ab1123015', name: 'Sadie', lang: 'en', gender: 'female', styles: ['病娇（尺度内）'] },
  { id: '15259c52cf5d41c28ea4394080e5e593', name: 'Marion', lang: 'en', gender: 'female', styles: ['高冷禁欲'] },
  { id: '9a9cf47702da476aa4629e2506d4a857', name: 'Hannah', lang: 'en', gender: 'female', styles: ['霸总'] },
  { id: 'ac23b666ac6149839d350ab4af7e4979', name: 'Charlotte', lang: 'en', gender: 'female', styles: ['冷静大人'] },
  // ja · 男
  { id: 'd738c70d206149e69f8e3b6fc8af9d96', name: 'じん', lang: 'ja', gender: 'male', styles: ['温柔年上', '姐姐系'] },
  { id: 'c496c7d0e93640a59a0befd78b47f39e', name: '颯太', lang: 'ja', gender: 'male', styles: ['小狗系年下', '阳光直球'] },
  { id: 'cbe9a9a0dde34b279a9e1b5da6e766b5', name: '涼太', lang: 'ja', gender: 'male', styles: ['依恋型'] },
  { id: '297a6fd278df47c3b9da9bfdf55ac89a', name: 'さとる', lang: 'ja', gender: 'male', styles: ['天然治愈', '病娇（尺度内）', '高冷禁欲'] },
  { id: '8fb06bac5bff4f51936abd2a36df1535', name: '陽翔', lang: 'ja', gender: 'male', styles: ['青梅竹马', '毒舌竹马', '傲娇'] },
  { id: '59a78821a8924989b70d2a63d588e8eb', name: 'まこと', lang: 'ja', gender: 'male', styles: ['腹黑', '霸总', '冷静大人'] },
  // ja · 女
  { id: 'b2d9d8db057042688a5e318b8f405bc2', name: 'きょうこ', lang: 'ja', gender: 'female', styles: ['温柔年上', '霸总', '冷静大人'] },
  { id: '97eda32449cf443bbc4b8782853ca554', name: 'あかり', lang: 'ja', gender: 'female', styles: ['小狗系年下', '阳光直球', '傲娇'] },
  { id: '35c8e5ae5239435f8d9c26c86802b86d', name: '美咲', lang: 'ja', gender: 'female', styles: ['姐姐系', '腹黑', '高冷禁欲'] },
  { id: '5da7f24e9e274f91b2b677669c818ce9', name: 'しおり', lang: 'ja', gender: 'female', styles: ['依恋型'] },
  { id: '49605213c91443e7bf6fddbf54e38890', name: '七海', lang: 'ja', gender: 'female', styles: ['天然治愈', '病娇（尺度内）'] },
  { id: '88b4365cf39d46e980f07cce0dab0478', name: '結衣', lang: 'ja', gender: 'female', styles: ['青梅竹马', '毒舌竹马'] },
  // ko · 男
  { id: '117adf85c36c41a792662458db470777', name: '도현', lang: 'ko', gender: 'male', styles: ['温柔年上', '天然治愈'] },
  { id: 'c57e2f9342954ccc9d676b25b676f92c', name: '준서', lang: 'ko', gender: 'male', styles: ['小狗系年下'] },
  { id: '7e81718fea7a4eacbd0ce650e457500f', name: '민수', lang: 'ko', gender: 'male', styles: ['姐姐系'] },
  { id: '69c83054095f4519b643d38b85446f27', name: '시우', lang: 'ko', gender: 'male', styles: ['依恋型', '青梅竹马'] },
  { id: 'd7ec83d63be940f19abd933eb7b28816', name: '도윤', lang: 'ko', gender: 'male', styles: ['阳光直球', '傲娇'] },
  { id: '1faa840246094164bf4b0b0b94ae1675', name: '지훈', lang: 'ko', gender: 'male', styles: ['毒舌竹马'] },
  { id: '2c0eeb4aaf4042d7a85843d1f6148c2c', name: '태오', lang: 'ko', gender: 'male', styles: ['腹黑', '高冷禁欲'] },
  { id: 'f3b62ddeb0fb4cac8c796c97c064f7cf', name: '우진', lang: 'ko', gender: 'male', styles: ['病娇（尺度内）'] },
  { id: '254244b09ba24af89b7e381c84a2506b', name: '민준', lang: 'ko', gender: 'male', styles: ['霸总'] },
  { id: '82703151e4b043dbbd98f082d4841b71', name: '건우', lang: 'ko', gender: 'male', styles: ['冷静大人'] },
  // ko · 女
  { id: '14a76e187ac64a46b99f4f6b49f885b9', name: '서연', lang: 'ko', gender: 'female', styles: ['温柔年上', '冷静大人'] },
  { id: '849c4e02d2f347bfafcbf355507f7808', name: '혜진', lang: 'ko', gender: 'female', styles: ['小狗系年下', '阳光直球'] },
  { id: '57f8381fb53c4bc68200d579c91c566b', name: '수아', lang: 'ko', gender: 'female', styles: ['姐姐系', '病娇（尺度内）'] },
  { id: 'c09e0a67c0ec4e3f90d3a04a55bc0b46', name: '지우', lang: 'ko', gender: 'female', styles: ['依恋型'] },
  { id: 'd02108f2e6124138b39004f3efce5e52', name: '서윤', lang: 'ko', gender: 'female', styles: ['天然治愈', '青梅竹马'] },
  { id: 'e2064c249afe4ac0abea622680a54073', name: '예린', lang: 'ko', gender: 'female', styles: ['毒舌竹马'] },
  { id: '8f3cc2e594cf4a96a5049cb538f1b6d6', name: '하은', lang: 'ko', gender: 'female', styles: ['傲娇'] },
  { id: '96ed4e3f47334430b990df471d0a0268', name: '하윤', lang: 'ko', gender: 'female', styles: ['腹黑', '高冷禁欲', '霸总'] },
];

/** 六位种子角色按恋爱类型取声（原 id；-en / -ja / -ko 版本同一类型，各语言自动落到自己的那把） */
export const SEED_STYLES: Record<string, string> = {
  'shen-zhiyan': '温柔年上',
  'jiang-ye': '毒舌竹马',
  'su-cheng': '姐姐系',
  'luo-xiaoman': '阳光直球',
  'zhu-yuan': '高冷禁欲',
  'hu-bugui': '腹黑',
};
