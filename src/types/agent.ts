export interface NodeMetadata {
  // basic
  customName: string;
  tags: string[];
  //price
  price: number;
  priceUnit: string;
  priceCycle: number; // 单位：天
  expireTime: string; // ISO 日期字符串，如 "2026-04-01"，空字符串表示未设置
  //location
  region: string;
  latitude?: number;
  longitude?: number;
  //display
  hidden: boolean;
  order: number;
}

export const metaKey2Attr = {
  // basic
  metadata_name: "customName",
  metadata_tags: "tags",
  //price
  metadata_price: "price",
  metadata_price_unit: "priceUnit",
  metadata_price_cycle: "priceCycle",
  metadata_expire_time: "expireTime",

  //location
  metadata_region: "region",
  metadata_latitude: "latitude",
  metadata_longitude: "longitude",

  //display
  metadata_order: "order",
  metadata_hidden: "hidden",
} as const;

type MetaReverseMap = {
  [K in keyof typeof metaKey2Attr as (typeof metaKey2Attr)[K]]: K;
};

export const metaAttr2Key = Object.fromEntries(
  Object.entries(metaKey2Attr).map(([k, v]) => [v, k]),
) as MetaReverseMap;

export interface NodeItem extends NodeMetadata {
  id: string;
}
