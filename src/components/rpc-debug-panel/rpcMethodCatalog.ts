export interface RpcMethodTemplate {
  method: string;
  module: string;
  hint: string;
  params: unknown;
}

const tokenPlaceholder = "__NODEGET_RPC_DEBUG_TOKEN__";

export const rpcMethodTemplates: RpcMethodTemplate[] = [
  {
    method: "nodeget-server_hello",
    module: "NodeGet",
    hint: "无鉴权",
    params: [],
  },
  {
    method: "nodeget-server_version",
    module: "NodeGet",
    hint: "无鉴权",
    params: [],
  },
  {
    method: "nodeget-server_uuid",
    module: "NodeGet",
    hint: "无鉴权",
    params: [],
  },
  {
    method: "nodeget-server_list_all_agent_uuid",
    module: "NodeGet",
    hint: "Token",
    params: { token: tokenPlaceholder },
  },
  {
    method: "nodeget-server_read_config",
    module: "NodeGet",
    hint: "SuperToken",
    params: { token: tokenPlaceholder },
  },
  {
    method: "nodeget-server_edit_config",
    module: "NodeGet",
    hint: "SuperToken",
    params: {
      token: tokenPlaceholder,
      config_string:
        'ws_listener = "0.0.0.0:2211"\nserver_uuid = "auto_gen"\njsonrpc_max_connections = 100\n\n[logging]\nlog_filter = "info"\n\n[database]\ndatabase_url = "sqlite://data/server.db?mode=rwc"',
    },
  },
  {
    method: "nodeget-server_database_storage",
    module: "NodeGet",
    hint: "SuperToken",
    params: { token: tokenPlaceholder },
  },
  {
    method: "nodeget-server_log",
    module: "NodeGet",
    hint: "SuperToken",
    params: { token: tokenPlaceholder },
  },
  {
    method: "nodeget-server_stream_log",
    module: "NodeGet",
    hint: "订阅",
    params: { token: tokenPlaceholder, log_filter: "info,rpc=debug" },
  },
  {
    method: "nodeget-server_unsubscribe_stream_log",
    module: "NodeGet",
    hint: "订阅",
    params: { subscription: "subscription_id_here" },
  },
  {
    method: "nodeget-server_self_update",
    module: "NodeGet",
    hint: "SuperToken",
    params: [tokenPlaceholder, "v0.0.14"],
  },
  {
    method: "agent-uuid_list_all",
    module: "Agent UUID",
    hint: "Token",
    params: { token: tokenPlaceholder },
  },
  {
    method: "agent-uuid_delete",
    module: "Agent UUID",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      agent_uuid: "e8583352-39e8-5a5b-b66c-e450689088fd",
    },
  },
  {
    method: "agent-uuid_list_all_with_agent_mode",
    module: "Agent UUID",
    hint: "Token",
    params: { token: tokenPlaceholder },
  },
  {
    method: "agent_report_static",
    module: "Monitoring",
    hint: "Agent",
    params: {
      token: tokenPlaceholder,
      static_monitoring_data: {
        uuid: "e8583352-39e8-5a5b-b66c-e450689088fd",
        time: 1769341269012,
        data_hash: [
          171, 205, 18, 52, 86, 120, 144, 171, 205, 239, 1, 35, 69, 103, 137,
          171,
        ],
        cpu: {
          physical_cores: 16,
          logical_cores: 32,
          per_core: [
            {
              id: 1,
              name: "CPU 1",
              vendor_id: "AuthenticAMD",
              brand: "AMD Ryzen 9 8945HX with Radeon Graphics",
            },
          ],
        },
        system: {
          system_name: "Windows",
          system_kernel: "26200",
          system_kernel_version: "Windows 11 IoT Enterprise LTSC 2024",
          system_os_version: "11 (26200)",
          system_os_long_version: "Windows 11 IoT Enterprise LTSC 2024",
          distribution_id: "windows",
          system_host_name: "DESKTOP-BI8T1T9",
          arch: "x86_64",
          virtualization: "HyperV",
        },
        gpu: [
          {
            id: 1,
            name: "NVIDIA GeForce RTX 5060 Laptop GPU",
            cuda_cores: 3328,
            architecture: "Blackwell",
          },
        ],
      },
    },
  },
  {
    method: "agent_report_dynamic",
    module: "Monitoring",
    hint: "Agent",
    params: {
      token: tokenPlaceholder,
      dynamic_monitoring_data: {
        uuid: "e8583352-39e8-5a5b-b66c-e450689088fd",
        time: 1769344168646,
        cpu: {
          per_core: [{ id: 1, cpu_usage: 13.43, frequency_mhz: 2007 }],
          total_cpu_usage: 4.04,
        },
        ram: {
          total_memory: 68501925888,
          available_memory: 41439596544,
          used_memory: 27062329344,
          total_swap: 0,
          used_swap: 0,
        },
        load: { one: 0, five: 0, fifteen: 0 },
        system: { boot_time: 1769337198, uptime: 6970, process_count: 313 },
        disk: [],
        network: { interfaces: [], udp_connections: 67, tcp_connections: 165 },
        gpu: [],
      },
    },
  },
  {
    method: "agent_report_dynamic_summary",
    module: "Monitoring",
    hint: "Agent",
    params: {
      token: tokenPlaceholder,
      dynamic_monitoring_summary_data: {
        uuid: "e8583352-39e8-5a5b-b66c-e450689088fd",
        time: 1769344168646,
        cpu_usage: 40,
        gpu_usage: 5,
        used_memory: 27062329344,
        total_memory: 68501925888,
        available_memory: 41439596544,
        load_one: 0,
        load_five: 0,
        load_fifteen: 0,
        uptime: 6970,
        boot_time: 1769337198,
        process_count: 313,
        total_space: 322057531392,
        available_space: 91563786240,
        read_speed: 35741,
        write_speed: 49550,
        tcp_connections: 165,
        udp_connections: 67,
        total_received: 527863209,
        total_transmitted: 484144450,
        transmit_speed: 1626,
        receive_speed: 5559,
      },
    },
  },
  {
    method: "agent_query_static",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      static_data_query: {
        fields: ["cpu", "system"],
        condition: [{ uuid: "e8583352-39e8-5a5b-b66c-e450689088fd" }, "last"],
      },
    },
  },
  {
    method: "agent_query_dynamic",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      dynamic_data_query: {
        fields: ["cpu", "ram"],
        condition: [
          { uuid: "e8583352-39e8-5a5b-b66c-e450689088fd" },
          { timestamp_from: 1769344160000 },
          { limit: 5 },
        ],
      },
    },
  },
  {
    method: "agent_query_static_avg",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      static_data_avg_query: {
        fields: ["cpu", "system"],
        uuid: "830cec66-8fc9-5c21-9e2d-2da2b2f2d3b3",
        timestamp_from: 1769344168646,
        timestamp_to: 1769347768646,
        points: 50,
      },
    },
  },
  {
    method: "agent_query_dynamic_avg",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      dynamic_data_avg_query: {
        fields: ["cpu", "ram"],
        uuid: "830cec66-8fc9-5c21-9e2d-2da2b2f2d3b3",
        timestamp_from: 1769344168646,
        timestamp_to: 1769347768646,
        points: 100,
      },
    },
  },
  {
    method: "agent_static_data_multi_last_query",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      uuids: [
        "e8583352-39e8-5a5b-b66c-e450689088fd",
        "830cec66-8fc9-5c21-9e2d-2da2b2f2d3b3",
      ],
      fields: ["cpu", "system"],
    },
  },
  {
    method: "agent_dynamic_data_multi_last_query",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      uuids: ["e8583352-39e8-5a5b-b66c-e450689088fd"],
      fields: ["cpu", "ram"],
    },
  },
  {
    method: "agent_delete_static",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      conditions: [
        { uuid: "830cec66-8fc9-5c21-9e2d-2da2b2f2d3b3" },
        { timestamp_to: 1769344168646 },
      ],
    },
  },
  {
    method: "agent_delete_dynamic",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      conditions: [
        { uuid: "830cec66-8fc9-5c21-9e2d-2da2b2f2d3b3" },
        { timestamp_to: 1769344168646 },
      ],
    },
  },
  {
    method: "agent_query_dynamic_summary",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      dynamic_summary_query: {
        fields: ["cpu_usage", "used_memory", "total_memory"],
        condition: [
          { uuid: "e8583352-39e8-5a5b-b66c-e450689088fd" },
          { timestamp_from: 1769344160000 },
          { limit: 5 },
        ],
      },
    },
  },
  {
    method: "agent_query_dynamic_summary_avg",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      dynamic_summary_avg_query: {
        fields: ["cpu_usage", "used_memory"],
        uuid: "830cec66-8fc9-5c21-9e2d-2da2b2f2d3b3",
        timestamp_from: 1769344168646,
        timestamp_to: 1769347768646,
        points: 100,
      },
    },
  },
  {
    method: "agent_dynamic_summary_multi_last_query",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      uuids: ["e8583352-39e8-5a5b-b66c-e450689088fd"],
      fields: ["cpu_usage", "used_memory"],
    },
  },
  {
    method: "agent_delete_dynamic_summary",
    module: "Monitoring",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      conditions: [
        { uuid: "830cec66-8fc9-5c21-9e2d-2da2b2f2d3b3" },
        { timestamp_to: 1769344168646 },
      ],
    },
  },
  {
    method: "task_register_task",
    module: "Task",
    hint: "Agent",
    params: { uuid: "AGENT_UUID_HERE" },
  },
  {
    method: "task_unregister_task",
    module: "Task",
    hint: "订阅",
    params: { subscription: "subscription_id_here" },
  },
  {
    method: "task_upload_task_result",
    module: "Task",
    hint: "Agent",
    params: {
      token: tokenPlaceholder,
      task_response: {
        task_id: 3,
        agent_uuid: "AGENT_UUID_HERE",
        task_token: "TASK_TOKEN_HERE",
        timestamp: 1769341269012,
        success: true,
        error_message: null,
        task_event_result: {},
      },
    },
  },
  {
    method: "task_create_task",
    module: "Task",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      target_uuid: "AGENT_UUID_HERE",
      task_type: { ping: "www.example.com" },
    },
  },
  {
    method: "task_create_task_blocking",
    module: "Task",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      target_uuid: "AGENT_UUID_HERE",
      task_type: { ping: "www.example.com" },
      timeout_ms: 5000,
    },
  },
  {
    method: "task_query",
    module: "Task",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      task_data_query: {
        condition: [
          { uuid: "42e89a61-39de-4569-b6ef-e86bc3ed8f82" },
          { type: "ping" },
          { limit: 10 },
        ],
      },
    },
  },
  {
    method: "task_delete",
    module: "Task",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      conditions: [
        { uuid: "42e89a61-39de-4569-b6ef-e86bc3ed8f82" },
        { type: "ping" },
        { limit: 100 },
      ],
    },
  },
  {
    method: "token_get",
    module: "Token",
    hint: "Token",
    params: { token: tokenPlaceholder },
  },
  {
    method: "token_create",
    module: "Token",
    hint: "SuperToken",
    params: {
      father_token: tokenPlaceholder,
      token_creation: {
        username: "GM",
        password: "ILoveRust1",
        timestamp_from: null,
        timestamp_to: null,
        token_limit: [
          {
            scopes: ["global"],
            permissions: [
              { dynamic_monitoring: "write" },
              { static_monitoring: "write" },
              { task: "listen" },
            ],
          },
        ],
      },
    },
  },
  {
    method: "token_delete",
    module: "Token",
    hint: "SuperToken",
    params: {
      token: tokenPlaceholder,
      target_token: "target_token_key_or_username",
    },
  },
  {
    method: "token_edit",
    module: "Token",
    hint: "SuperToken",
    params: {
      token: tokenPlaceholder,
      target_token: "target_token_key_or_username",
      limit: [
        {
          scopes: ["global"],
          permissions: [{ task: { read: "ping" } }, { task: "listen" }],
        },
      ],
    },
  },
  {
    method: "token_list_all_tokens",
    module: "Token",
    hint: "SuperToken",
    params: { token: tokenPlaceholder },
  },
  {
    method: "token_change_password",
    module: "Token",
    hint: "SuperToken",
    params: {
      token: tokenPlaceholder,
      target_token: "target_token_key_or_username",
      new_password: "NewPass123",
    },
  },
  {
    method: "token_roll_token_secret",
    module: "Token",
    hint: "SuperToken",
    params: {
      token: tokenPlaceholder,
      target_token: "target_token_key_or_username",
    },
  },
  {
    method: "crontab_create",
    module: "Crontab",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      name: "ping_task",
      cron_expression: "0 * * * * *",
      cron_type: {
        agent: [
          ["00000000-0000-0000-0000-000000000001"],
          { task: { ping: "www.example.com" } },
        ],
      },
    },
  },
  {
    method: "crontab_edit",
    module: "Crontab",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      name: "ping_task",
      cron_expression: "0 */5 * * * *",
      cron_type: {
        agent: [
          ["00000000-0000-0000-0000-000000000001"],
          { task: { tcp_ping: "www.example.com:443" } },
        ],
      },
    },
  },
  {
    method: "crontab_get",
    module: "Crontab",
    hint: "Token",
    params: { token: tokenPlaceholder },
  },
  {
    method: "crontab_delete",
    module: "Crontab",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "ping_task" },
  },
  {
    method: "crontab_set_enable",
    module: "Crontab",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "ping_task", enable: true },
  },
  {
    method: "crontab-result_query",
    module: "CrontabResult",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      query: { condition: [{ cron_name: "cleanup_database" }, "last"] },
    },
  },
  {
    method: "crontab-result_delete",
    module: "CrontabResult",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      query: { condition: [{ cron_name: "cleanup_database" }, { limit: 10 }] },
    },
  },
  {
    method: "js-worker_create",
    module: "JsWorker",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      name: "demo_worker",
      description: "demo worker for monitoring",
      js_script_base64:
        "ZXhwb3J0IGRlZmF1bHQgeyBhc3luYyBvbkNhbGwocGFyYW1zLCBlbnYsIGN0eCkgeyByZXR1cm4geyBvazogdHJ1ZSB9OyB9IH07",
      route_name: "demo_route",
      runtime_clean_time: 60000,
      env: { project: "NodeGet" },
      max_run_time: 30000,
      max_stack_size: 1048576,
      max_heap_size: 8388608,
    },
  },
  {
    method: "js-worker_read",
    module: "JsWorker",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "demo_worker" },
  },
  {
    method: "js-worker_update",
    module: "JsWorker",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      name: "demo_worker",
      description: "demo worker v2",
      js_script_base64:
        "ZXhwb3J0IGRlZmF1bHQgeyBhc3luYyBvbkNhbGwocGFyYW1zLCBlbnYsIGN0eCkgeyByZXR1cm4geyB2ZXJzaW9uOiAyIH07IH0gfTs=",
      route_name: "demo_route_v2",
      runtime_clean_time: 120000,
      env: { project: "NodeGet" },
      max_run_time: 60000,
      max_stack_size: 2097152,
      max_heap_size: 16777216,
    },
  },
  {
    method: "js-worker_delete",
    module: "JsWorker",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "demo_worker" },
  },
  {
    method: "js-worker_run",
    module: "JsWorker",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      js_script_name: "demo_worker",
      run_type: "call",
      params: { hello: "world" },
    },
  },
  {
    method: "js-worker_list_all_js_worker",
    module: "JsWorker",
    hint: "Token",
    params: { token: tokenPlaceholder },
  },
  {
    method: "js-worker_get_rt_pool",
    module: "JsWorker",
    hint: "Token",
    params: { token: tokenPlaceholder },
  },
  {
    method: "js-result_query",
    module: "JsResult",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      query: { condition: [{ js_worker_name: "demo_worker" }, { limit: 10 }] },
    },
  },
  {
    method: "js-result_delete",
    module: "JsResult",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      query: {
        condition: [
          { js_worker_name: "demo_worker" },
          "is_failure",
          { limit: 50 },
        ],
      },
    },
  },
  {
    method: "kv_set_value",
    module: "KV",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      namespace: "kv_test",
      key: "metadata_test",
      value: [12312313213],
    },
  },
  {
    method: "kv_get_value",
    module: "KV",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      namespace: "kv_test",
      key: "metadata_test",
    },
  },
  {
    method: "kv_get_multi_value",
    module: "KV",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      namespace_key: [
        { namespace: "ns1", key: "key1" },
        { namespace: "ns1", key: "metadata_*" },
      ],
    },
  },
  {
    method: "kv_delete_key",
    module: "KV",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      namespace: "kv_test",
      key: "metadata_test",
    },
  },
  {
    method: "kv_delete_namespace",
    module: "KV",
    hint: "Token",
    params: { token: tokenPlaceholder, namespace: "kv_test" },
  },
  {
    method: "kv_get_all_keys",
    module: "KV",
    hint: "Token",
    params: { token: tokenPlaceholder, namespace: "kv_test" },
  },
  {
    method: "kv_create",
    module: "KV",
    hint: "SuperToken",
    params: { token: tokenPlaceholder, namespace: "kv_test" },
  },
  {
    method: "kv_list_all_namespace",
    module: "KV",
    hint: "Token",
    params: { token: tokenPlaceholder },
  },
  {
    method: "static-bucket_create",
    module: "Static",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      name: "my-site",
      path: "sites/my-site",
      is_http_root: false,
      cors: true,
    },
  },
  {
    method: "static-bucket_read",
    module: "Static",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "my-site" },
  },
  {
    method: "static-bucket_update",
    module: "Static",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      name: "my-site",
      path: "sites/my-site",
      is_http_root: true,
      cors: true,
    },
  },
  {
    method: "static-bucket_delete",
    module: "Static",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "my-site" },
  },
  {
    method: "static-bucket_list",
    module: "Static",
    hint: "SuperToken",
    params: { token: tokenPlaceholder },
  },
  {
    method: "static-bucket-file_upload",
    module: "Static",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      name: "my-site",
      path: "/index.html",
      base64:
        "PCFET0NUWVBFIGh0bWw+PGh0bWw+PGJvZHk+SGVsbG88L2JvZHk+PC9odG1sPg==",
    },
  },
  {
    method: "static-bucket-file_read",
    module: "Static",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "my-site", path: "/index.html" },
  },
  {
    method: "static-bucket-file_delete",
    module: "Static",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "my-site", path: "/index.html" },
  },
  {
    method: "static-bucket-file_rename",
    module: "Static",
    hint: "Token",
    params: {
      token: tokenPlaceholder,
      name: "my-site",
      from: "/old-name.html",
      to: "/pages/new-name.html",
    },
  },
  {
    method: "static-bucket-file_list",
    module: "Static",
    hint: "Token",
    params: { token: tokenPlaceholder, name: "my-site" },
  },
];

export const methodCatalog = rpcMethodTemplates.map((item) => item.method);

export const methodHints: Record<string, string> = Object.fromEntries(
  rpcMethodTemplates.map((item) => [
    item.method,
    `${item.module} / ${item.hint}`,
  ]),
);

export function getRpcMethodTemplate(method: string) {
  return rpcMethodTemplates.find((item) => item.method === method);
}

export function buildRpcMethodParams(method: string, token: string) {
  const template = getRpcMethodTemplate(method);
  if (!template) return undefined;
  return replaceTokenPlaceholder(template.params, token);
}

function replaceTokenPlaceholder(value: unknown, token: string): unknown {
  if (value === tokenPlaceholder) return token;
  if (Array.isArray(value)) {
    return value.map((item) => replaceTokenPlaceholder(item, token));
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      replaceTokenPlaceholder(item, token),
    ]),
  );
}
