export interface Expense {
  id: string;
  amount: number; // 单位：元
  category: string;
  note?: string;
  date: string; // YYYY-MM-DD
  createdAt: number;
}

export interface Category {
  name: string;
  color: string;
}

export type Period = 'day' | 'week' | 'month';

export const CATEGORY_COLORS = [
  '#E8927C', // 珊瑚橙
  '#E5B567', // 杏黄
  '#7FB685', // 鼠尾草绿
  '#6FA8C9', // 雾蓝
  '#B48BC7', // 薰衣草紫
  '#E57F9E', // 蔷薇粉
  '#8FBFA8', // 薄荷绿
  '#C9A66B', // 驼色
  '#7E8BC9', // 灰蓝紫
  '#D97B66', // 陶土红
  '#5FA8A0', // 青碧
  '#A8A8A0', // 暖灰
];
