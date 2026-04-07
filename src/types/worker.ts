export interface JsWorker {
  id: string;
  name: string;
  route: string;
  content: string;
  created_at: number;
  updated_at: number;
  env?: Record<string, string>;
  runtime_clean_time?: number | null;
  description?: string;
}
export interface JsResult {
  id: number;
  js_worker_id: number;
  js_worker_name: string;
  start_time: number;
  finish_time: number | null;
  param: any;
  result: any;
  error_message: string | null;
}
