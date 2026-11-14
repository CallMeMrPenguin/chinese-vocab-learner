// Cloudflare Worker Entrypoint (Static Assets + Auth + 3-Step D1 Auto-Sync API)

export interface Env {
  ASSETS: {
    fetch: (req: Request) => Promise<Response>;
  };
  DB?: {
    prepare: (query: string) => {
      bind: (...values: unknown[]) => {
        first: <T = Record<string, unknown>>() => Promise<T | null>;
        run: () => Promise<unknown>;
      };
      run: () => Promise<unknown>;
    };
  };
}

async function ensureTables(db: NonNullable<Env['DB']>) {
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_sync_snapshot (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    )
    .run();

  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS user_accounts (
        username TEXT PRIMARY KEY,
        account_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`
    )
    .run();
}

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // ── 1. Handle /api/auth (Cloud Profile Sync for Login / Register / Reset Password)
    if (url.pathname === '/api/auth') {
      if (!env.DB) {
        return new Response(
          JSON.stringify({ enabled: false }),
          { status: 200, headers: jsonHeaders }
        );
      }

      try {
        await ensureTables(env.DB);
        const username = (url.searchParams.get('username') || '').trim().toLowerCase();

        if (request.method === 'GET' && username) {
          const row = await env.DB.prepare(
            'SELECT account_json, updated_at FROM user_accounts WHERE username = ?1'
          )
            .bind(username)
            .first<{ account_json: string; updated_at: string }>();

          return new Response(
            JSON.stringify({
              enabled: true,
              account: row ? JSON.parse(row.account_json) : null,
            }),
            { status: 200, headers: jsonHeaders }
          );
        }

        if (request.method === 'POST') {
          const body = await request.json() as { username?: string; account?: unknown };
          const u = (body?.username || '').trim().toLowerCase();
          if (!u || !body?.account) {
            return new Response(JSON.stringify({ ok: false }), {
              status: 400,
              headers: jsonHeaders,
            });
          }
          const now = new Date().toISOString();
          await env.DB.prepare(
            `INSERT INTO user_accounts (username, account_json, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(username) DO UPDATE SET
               account_json = excluded.account_json,
               updated_at = excluded.updated_at`
          )
            .bind(u, JSON.stringify(body.account), now)
            .run();

          return new Response(
            JSON.stringify({ ok: true, enabled: true, updatedAt: now }),
            { status: 200, headers: jsonHeaders }
          );
        }
      } catch (err) {
        return new Response(
          JSON.stringify({ enabled: false, error: String(err) }),
          { status: 200, headers: jsonHeaders }
        );
      }
    }

    // ── 2. Handle /api/sync for 3-Step Automatic Sync with Cloudflare D1
    if (url.pathname === '/api/sync') {
      const userId = (url.searchParams.get('user') || 'default_user').trim().toLowerCase();

      if (!env.DB) {
        return new Response(
          JSON.stringify({
            enabled: false,
            userId,
            message:
              'Chưa gắn D1 Database binding (tên biến: DB) trong Worker Settings -> Bindings.',
          }),
          { status: 200, headers: jsonHeaders }
        );
      }

      try {
        await ensureTables(env.DB);

        if (request.method === 'GET') {
          const row = await env.DB.prepare(
            'SELECT payload_json, updated_at FROM user_sync_snapshot WHERE id = ?1'
          )
            .bind(userId)
            .first<{ payload_json: string; updated_at: string }>();

          if (!row) {
            return new Response(
              JSON.stringify({
                enabled: true,
                userId,
                status: 'connected_empty',
                updatedAt: null,
                data: null,
              }),
              { status: 200, headers: jsonHeaders }
            );
          }

          const parsed = JSON.parse(row.payload_json);
          return new Response(
            JSON.stringify({
              enabled: true,
              userId,
              status: 'connected_has_data',
              updatedAt: row.updated_at,
              summary: {
                foldersCount: parsed?.folders?.length ?? 0,
                decksCount: parsed?.decks?.length ?? 0,
                vocabCount: parsed?.vocab?.length ?? 0,
                practicedVocabCount: (parsed?.vocab || []).filter(
                  (w: Record<string, number | boolean>) =>
                    (Number(w.flashcardStep) || 0) > 0 ||
                    (Number(w.matchingStep) || 0) > 0 ||
                    (Number(w.writingZhStep) || 0) > 0 ||
                    (Number(w.writingViStep) || 0) > 0 ||
                    Boolean(w.isMastered)
                ).length,
              },
              data: parsed,
            }),
            { status: 200, headers: jsonHeaders }
          );
        }

        if (request.method === 'POST') {
          const bodyText = await request.text();
          if (!bodyText) {
            return new Response(
              JSON.stringify({ ok: false, error: 'Empty payload' }),
              { status: 400, headers: jsonHeaders }
            );
          }

          const parsed = JSON.parse(bodyText);
          const targetUser = (parsed?.userId || userId || 'default_user').trim().toLowerCase();
          const now = parsed?.updatedAt || new Date().toISOString();

          await env.DB.prepare(
            `INSERT INTO user_sync_snapshot (id, payload_json, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(id) DO UPDATE SET
               payload_json = excluded.payload_json,
               updated_at = excluded.updated_at`
          )
            .bind(targetUser, bodyText, now)
            .run();

          return new Response(
            JSON.stringify({ ok: true, enabled: true, userId: targetUser, updatedAt: now }),
            { status: 200, headers: jsonHeaders }
          );
        }
      } catch (err) {
        return new Response(
          JSON.stringify({ enabled: false, error: String(err) }),
          { status: 200, headers: jsonHeaders }
        );
      }
    }

    // Serve static Next.js files from ./out
    return env.ASSETS.fetch(request);
  },
};

export default worker;
