export interface RegionCoord {
  code: string;
  name: string;
  coord: [number, number];
}

export const REGION_COORDS: Record<string, RegionCoord> = {
  HK: { code: "HK", name: "香港", coord: [114.1694, 22.3193] },
  TW: { code: "TW", name: "台湾", coord: [121.5654, 25.033] },
  MO: { code: "MO", name: "澳门", coord: [113.5439, 22.1987] },
  CN: { code: "CN", name: "中国大陆", coord: [116.4074, 39.9042] },
  JP: { code: "JP", name: "日本", coord: [139.6917, 35.6895] },
  KR: { code: "KR", name: "韩国", coord: [126.978, 37.5665] },
  SG: { code: "SG", name: "新加坡", coord: [103.8198, 1.3521] },
  MY: { code: "MY", name: "马来西亚", coord: [101.6869, 3.139] },
  TH: { code: "TH", name: "泰国", coord: [100.5018, 13.7563] },
  VN: { code: "VN", name: "越南", coord: [105.8342, 21.0278] },
  PH: { code: "PH", name: "菲律宾", coord: [120.9842, 14.5995] },
  ID: { code: "ID", name: "印度尼西亚", coord: [106.8456, -6.2088] },
  IN: { code: "IN", name: "印度", coord: [77.209, 28.6139] },
  US: { code: "US", name: "美国", coord: [-77.0369, 38.9072] },
  CA: { code: "CA", name: "加拿大", coord: [-75.6972, 45.4215] },
  MX: { code: "MX", name: "墨西哥", coord: [-99.1332, 19.4326] },
  BR: { code: "BR", name: "巴西", coord: [-47.8825, -15.7942] },
  AR: { code: "AR", name: "阿根廷", coord: [-58.3816, -34.6037] },
  GB: { code: "GB", name: "英国", coord: [-0.1276, 51.5072] },
  DE: { code: "DE", name: "德国", coord: [13.405, 52.52] },
  FR: { code: "FR", name: "法国", coord: [2.3522, 48.8566] },
  NL: { code: "NL", name: "荷兰", coord: [4.9041, 52.3676] },
  RU: { code: "RU", name: "俄罗斯", coord: [37.6173, 55.7558] },
  TR: { code: "TR", name: "土耳其", coord: [32.8597, 39.9334] },
  AU: { code: "AU", name: "澳大利亚", coord: [149.13, -35.2809] },
  ZA: { code: "ZA", name: "南非", coord: [28.2293, -25.7461] },
};
