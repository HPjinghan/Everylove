/**
 * 外出地点（D-038）：把相处从手机屏幕里拿出来的几个常见空间。
 * scene 是给对话引擎的场景设定（进外出模式 prompt）；hook 是给用户看的一句话。
 * 纪律同桌面：做少而真——每个地点必须有可玩的场景语法才上架。
 */

export interface Place {
  id: string;
  name: string;
  emoji: string;
  /** 给用户看的一句钩子 */
  hook: string;
  /** 给引擎的场景设定：这里长什么样、有什么可互动的东西 */
  scene: string;
  /** 卡片渐变底色 */
  colors: [string, string];
  /** 陌生人地点（D-040）：进去偶遇的是还没配对的角色；不出现在约定选项里 */
  stranger?: boolean;
}

export const PLACES: Place[] = [
  {
    id: 'plaza',
    name: '广场',
    emoji: '⛲',
    hook: '人人都会接你的话',
    scene:
      '城市中心的开放广场：喷泉的水声、卖气球和烤红薯的摊子、有人弹吉他有人喂鸽子，长椅永远留着半个位置——在这里，陌生人搭话是再自然不过的事。',
    colors: ['#FFE9D6', '#FFC9A3'],
    stranger: true,
  },
  {
    id: 'cafe',
    name: '街角咖啡馆',
    emoji: '☕',
    hook: '靠窗的位置正好空着',
    scene:
      '一家安静的街角咖啡馆：木质吧台、暖黄灯光、玻璃柜里有当日的蛋糕，靠窗的双人位能看到街上来往的人，杯子放下时有轻轻的瓷器声。',
    colors: ['#F5E6D3', '#E8CDB0'],
  },
  {
    id: 'park',
    name: '城南公园',
    emoji: '🌳',
    hook: '风把树影吹得晃晃的',
    scene:
      '傍晚的城市公园：长长的林荫道、湖边的长椅、有人在遛狗和慢跑，贩卖机能买到热饮，风穿过树叶的声音一直都在。',
    colors: ['#E3F2DC', '#C6E2BB'],
  },
  {
    id: 'bookstore',
    name: '深夜书店',
    emoji: '📚',
    hook: '有一排书只亮着一盏灯',
    scene:
      '一家开到很晚的独立书店：高高的书架之间只容两个人侧身走过，角落有旧沙发和一盏台灯，翻书声和很轻的爵士乐，店猫偶尔从脚边经过。',
    colors: ['#E8E4F5', '#CFC6EA'],
  },
  {
    id: 'cinema',
    name: '老电影院',
    emoji: '🎬',
    hook: '这一场几乎包场',
    scene:
      '一家老式电影院：绒布座椅、爆米花的甜味、开场前灯光慢慢暗下来，片尾字幕滚动时整个厅只剩你们和放映机的光。',
    colors: ['#E4E9F5', '#C3CEEA'],
  },
  {
    id: 'funfair',
    name: '游乐园',
    emoji: '🎡',
    hook: '摩天轮转到最高处会停一下',
    scene:
      '傍晚的游乐园：旋转木马的灯刚亮起来、套圈摊位的老板在吆喝、棉花糖比脸还大，摩天轮转到最高处会轻轻停一下，能看到整座城市。',
    colors: ['#FDE7EC', '#F8C8D6'],
  },
  {
    id: 'seaside',
    name: '海边栈道',
    emoji: '🌊',
    hook: '浪声比想象里近',
    scene:
      '沿海的木栈道：海风带着一点咸味、栏杆上停着海鸟、走到尽头有一座小灯塔，浪一遍一遍拍在礁石上，说话要稍微凑近一点才听得清。',
    colors: ['#DCEFF5', '#B8D8E8'],
  },
];

export function placeById(id: string): Place | undefined {
  return PLACES.find((p) => p.id === id);
}
