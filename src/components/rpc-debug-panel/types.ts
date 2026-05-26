export type RpcDebugTabKey =
  | "network"
  | "composer"
  | "subscription"
  | "auth"
  | "settings";

export interface RpcDebugTab {
  key: RpcDebugTabKey;
  label: string;
}

export interface ComposerDraft {
  method: string;
  requestId: string;
  backendKey: string;
  paramsText: string;
  sending: boolean;
  responseText: string;
  responseMeta: string;
  responseMethod: string;
}

export interface StreamSubscriptionState {
  backendKey: string;
  logFilter: string;
  status: string;
  subscriptionId: string;
  events: unknown[];
}
