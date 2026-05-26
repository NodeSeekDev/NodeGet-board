import {
  cloneTokenLimitEntries,
  createDefaultToken,
  DEFAULT_SCOPE,
} from "./scopeCodec.ts";
import type { PermissionEntry, Token, TokenLimitEntry } from "./type.ts";
import { generatePassword } from "../../lib/password.ts";
import { TASK_NAME_LIST } from "@/types/task.ts";

export type TokenTemplate = {
  id: string;
  nameKey: string;
  descriptionKey: string;
  token_limit: TokenLimitEntry[];
};

export const AGENT_TEMPLATE_PERMISSIONS: PermissionEntry[] = [
  { static_monitoring: "write" },
  { dynamic_monitoring: "write" },
  { dynamic_monitoring_summary: "write" },
  { task: "listen" },
  ...TASK_NAME_LIST.map((t) => ({
    task: { write: t },
  })),
];

export const VISITOR_TEMPLATE_PERMISSIONS: PermissionEntry[] = [
  { static_monitoring: { read: "cpu" } },
  { static_monitoring: { read: "system" } },
  { static_monitoring: { read: "gpu" } },
  { dynamic_monitoring_summary: "read" },
  { node_get: "list_all_agent_uuid" },
  { task: { read: "ping" } },
  { task: { read: "tcp_ping" } },
  { kv: { read: "metadata_*" } },
];

export const TOKEN_TEMPLATES: TokenTemplate[] = [
  {
    id: "agent",
    nameKey: "dashboard.token.templates.agent.title",
    descriptionKey: "dashboard.token.templates.agent.description",
    token_limit: [
      {
        scopes: [...DEFAULT_SCOPE],
        permissions: AGENT_TEMPLATE_PERMISSIONS.map((item) => ({ ...item })),
      },
    ],
  },
  {
    id: "visitor",
    nameKey: "dashboard.token.templates.visitor.title",
    descriptionKey: "dashboard.token.templates.visitor.description",
    token_limit: [
      {
        scopes: [...DEFAULT_SCOPE],
        permissions: VISITOR_TEMPLATE_PERMISSIONS.map((item) => ({
          ...item,
        })),
      },
    ],
  },
];

export const getTokenTemplateById = (id: string) =>
  TOKEN_TEMPLATES.find((template) => template.id === id);

export const createTemplateTokenCredentials = (
  templateId: string,
  createRandomString: (length?: number) => string = generatePassword,
) => ({
  username: `${templateId}-template-${createRandomString(16)}`,
  password: createRandomString(16),
});

export const createTokenFromTemplate = (
  templateOrId: TokenTemplate | string,
  createRandomString: (length?: number) => string = generatePassword,
): Token => {
  const template =
    typeof templateOrId === "string"
      ? getTokenTemplateById(templateOrId)
      : templateOrId;

  if (!template) {
    throw new Error("token_template_not_found");
  }

  const baseToken = createDefaultToken();
  const credentials = createTemplateTokenCredentials(
    template.id,
    createRandomString,
  );

  return {
    ...baseToken,
    ...credentials,
    token_limit: cloneTokenLimitEntries(template.token_limit),
  };
};

export const createCustomToken = (
  createRandomString: (length?: number) => string = generatePassword,
): Token => ({
  ...createDefaultToken(),
  ...createTemplateTokenCredentials("custom", createRandomString),
});
