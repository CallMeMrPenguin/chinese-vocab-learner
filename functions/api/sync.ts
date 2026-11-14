// Cloudflare Pages Function: /api/sync
// Tự động lưu & tải tiến độ học từ Cloudflare D1 (nếu đã gắn D1 binding tên là DB)

interface Env {
  DB?: {
    prepare: (query: string) => {
      bind: (...values: unknown[]) => {
        first: <T = Record<string, unknown>>() => Promise<T | null>;
        run: () => Promise<unknown>;
      };
    };
  };
}

export const onRequestGet = async (context: { env: Env }) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ enabled: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const row = await context.env.DB.prepare(
      'SELECT payload_json, updated_at FROM user_sync_snapshot WHERE id = ?1'
    )
      .bind('default_user')
      .first<{ payload_json: string; updated_at: string }>();

    if (!row) {
      return new Response(JSON.stringify({ enabled: true, data: null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        enabled: true,
        updatedAt: row.updated_at,
        data: JSON.parse(row.payload_json),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ enabled: false, error: String(err) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const onRequestPost = async (context: { request: Request; env: Env }) => {
  try {
    if (!context.env.DB) {
      return new Response(JSON.stringify({ enabled: false }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bodyText = await context.request.text();
    if (!bodyText) {
      return new Response(JSON.stringify({ ok: false }), { status: 400 });
    }

    const now = new Date().toISOString();
    await context.env.DB.prepare(
      `INSERT INTO user_sync_snapshot (id, payload_json, updated_at)
       VALUES (?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at`
    )
      .bind('default_user', bodyText, now)
      .run();

    return new Response(JSON.stringify({ ok: true, updatedAt: now }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
