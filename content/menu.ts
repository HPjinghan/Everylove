/**
 * 外卖菜单（D-129）：几家店、每家几样东西，价格是 Coin。名字是中文键（界面 t()，lib/i18n.ts 有 en / ja / ko）。
 * 是内容不是生成——TA 给她点的东西（[点外卖 …]）由模型自由写，她点的从这张单子里选。
 */

export interface MenuItem {
  id: string;
  name: string;
  price: number;
  /** 口味标签（给 TA 反应用，进卡片上下文） */
  tag?: string;
}

export interface MenuStore {
  id: string;
  name: string;
  emoji: string;
  items: MenuItem[];
}

export const MENU: MenuStore[] = [
  {
    id: 'tea',
    name: '奶茶店',
    emoji: '🧋',
    items: [
      { id: 'milk-tea', name: '珍珠奶茶', price: 18 },
      { id: 'fruit-tea', name: '水果茶', price: 16 },
      { id: 'latte', name: '拿铁', price: 22 },
      { id: 'americano', name: '美式', price: 18 },
    ],
  },
  {
    id: 'store',
    name: '便利店',
    emoji: '🏪',
    items: [
      { id: 'oden', name: '关东煮', price: 12 },
      { id: 'rice-ball', name: '饭团', price: 8 },
      { id: 'ginger-tea', name: '姜茶', price: 10 },
      { id: 'cold-medicine', name: '感冒药', price: 25 },
      { id: 'umbrella', name: '雨伞', price: 30 },
    ],
  },
  {
    id: 'meal',
    name: '正餐',
    emoji: '🍱',
    items: [
      { id: 'bento', name: '便当', price: 30 },
      { id: 'noodles', name: '一碗面', price: 28 },
      { id: 'sushi', name: '寿司', price: 60 },
      { id: 'curry', name: '咖喱饭', price: 32 },
    ],
  },
  {
    id: 'night',
    name: '夜宵',
    emoji: '🍢',
    items: [
      { id: 'bbq', name: '烧烤', price: 45 },
      { id: 'fried-rice', name: '炒饭', price: 25 },
      { id: 'crayfish', name: '小龙虾', price: 88 },
      { id: 'congee', name: '热粥', price: 15 },
    ],
  },
  {
    id: 'sweet',
    name: '甜品',
    emoji: '🍰',
    items: [
      { id: 'cake', name: '蛋糕', price: 32 },
      { id: 'ice-cream', name: '冰淇淋', price: 15 },
      { id: 'pudding', name: '布丁', price: 12 },
    ],
  },
  {
    id: 'flower',
    name: '花店',
    emoji: '💐',
    items: [
      { id: 'bouquet', name: '一束花', price: 99 },
      { id: 'single-rose', name: '一支玫瑰', price: 20 },
    ],
  },
];

export function menuStore(id: string): MenuStore | undefined {
  return MENU.find((s) => s.id === id);
}

export function menuItem(storeId: string, itemId: string): MenuItem | undefined {
  return menuStore(storeId)?.items.find((i) => i.id === itemId);
}
