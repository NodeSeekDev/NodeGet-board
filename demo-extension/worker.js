export default {
  async onRoute(request, env, ctx) {
    const url = new URL(request.url);

    // 读取 cron 最后执行时间
    if (url.pathname.endsWith("/api/status")) {
      const last = await ctx.kv.get("demo:last_cron");
      return new Response(
        JSON.stringify({
          last_cron: last ?? "尚未触发",
          token_ok: !!env.token,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("extension worker running", { status: 200 });
  },

  async onCron(params, env, ctx) {
    // 写入触发时间，用于验证 cron 是否真的跑了
    await ctx.kv.set("demo:last_cron", new Date().toISOString());
    return { ok: true };
  },
};
