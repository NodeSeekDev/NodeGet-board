export interface NodeMetadata {
  name: string;
  tags: string[];
  price: number;
  priceUnit: string;
  priceCycle: number; // 单位：天
  expireTime: string; // ISO 日期字符串，如 "2026-04-01"，空字符串表示未设置
  region: string;
  hidden: boolean;
  order: number;
}

export interface NodeItem extends NodeMetadata {
  id: string;
}
