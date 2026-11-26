interface DurableObjectStorageLike {
  delete(key: string): Promise<boolean>;
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: string): Promise<void>;
  setAlarm(scheduledTime: number): Promise<void>;
}

interface DurableObjectStateLike {
  storage: DurableObjectStorageLike;
}

interface SessionStoreEnv {
  SESSION_ENCRYPTION_KEY: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_URL: string;
}

interface StoredSession {
  access_token: string;
  expires_at: number;
  refresh_token: string;
  token_type: string;
  user: { id: string; email?: string | null };
  isPasswordRecovery?: boolean;
}

interface StoredAuthFlow {
  expires_at: number;
  flow: string;
  next: string;
  type: "oauth";
  verifier: string;
}

interface SessionRecord {
  expires_at: number;
  flow?: StoredAuthFlow;
  session?: StoredSession;
}

const RECORD_KEY = "encrypted-session-v1";
const ADDITIONAL_DATA = new TextEncoder().encode("revit-session-v1");
const REFRESH_EARLY_SECONDS = 60;

interface RefreshResult {
  body: Record<string, unknown>;
  status: number;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getEncryptionKey(encodedKey: string): Promise<CryptoKey> {
  const bytes = base64ToBytes(encodedKey);
  if (bytes.byteLength !== 32) {
    throw new Error("SESSION_ENCRYPTION_KEY must decode to 32 bytes.");
  }
  return crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export class SessionStore {
  private stateRevision = 0;
  private refreshInFlight: Promise<RefreshResult> | null = null;

  constructor(
    private readonly state: DurableObjectStateLike,
    private readonly env: SessionStoreEnv,
  ) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/session" && url.pathname !== "/refresh") {
      return json({ error: "not_found" }, 404);
    }

    if (url.pathname === "/session" && request.method === "GET") {
      try {
        const record = await this.readRecord();
        return record ? json(record) : json({ error: "not_found" }, 404);
      } catch {
        return json({ error: "session_store_unavailable" }, 503);
      }
    }

    if (url.pathname === "/session" && request.method === "PUT") {
      this.stateRevision += 1;
      let record: SessionRecord;
      try {
        record = (await request.json()) as SessionRecord;
      } catch {
        return json({ error: "invalid_record" }, 400);
      }
      if (!this.isValidRecord(record)) {
        return json({ error: "invalid_record" }, 400);
      }
      try {
        await this.writeRecord(record);
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        });
      } catch {
        return json({ error: "session_store_unavailable" }, 503);
      }
    }

    if (url.pathname === "/session" && request.method === "DELETE") {
      this.stateRevision += 1;
      try {
        await this.state.storage.delete(RECORD_KEY);
        return new Response(null, {
          status: 204,
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        });
      } catch {
        return json({ error: "session_store_unavailable" }, 503);
      }
    }

    if (url.pathname === "/refresh" && request.method === "POST") {
      return this.refreshSession();
    }

    return json({ error: "method_not_allowed" }, 405);
  }

  async alarm(): Promise<void> {
    const record = await this.readRecord();
    if (!record) return;
    await this.state.storage.setAlarm(record.expires_at);
  }

  private async refreshSession(): Promise<Response> {
    if (!this.refreshInFlight) {
      const operation = this.runRefreshSession();
      this.refreshInFlight = operation;
      void operation.then(
        () => {
          if (this.refreshInFlight === operation) this.refreshInFlight = null;
        },
        () => {
          if (this.refreshInFlight === operation) this.refreshInFlight = null;
        },
      );
    }
    const result = await this.refreshInFlight;
    return json(result.body, result.status);
  }

  private async runRefreshSession(): Promise<RefreshResult> {
    const startingRevision = this.stateRevision;
    let record: SessionRecord | null;
    try {
      record = await this.readRecord();
    } catch {
      return { body: { error: "session_store_unavailable" }, status: 503 };
    }

    if (!record?.session) {
      return { body: { error: "unauthenticated" }, status: 401 };
    }

    if (
      record.session.expires_at >
      Math.floor(Date.now() / 1000) + REFRESH_EARLY_SECONDS
    ) {
      return { body: { session: record.session }, status: 200 };
    }

    let refreshResponse: Response;
    try {
      refreshResponse = await fetch(
        `${this.env.SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=refresh_token`,
        {
          method: "POST",
          headers: {
            apikey: this.env.SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: record.session.refresh_token }),
        },
      );
    } catch {
      return { body: { error: "auth_provider_unavailable" }, status: 503 };
    }

    if (!refreshResponse.ok) {
      if (refreshResponse.status === 429 || refreshResponse.status >= 500) {
        return { body: { error: "auth_provider_unavailable" }, status: 503 };
      }
      let currentRecord: SessionRecord | null;
      try {
        currentRecord = await this.readRecord();
      } catch {
        return { body: { error: "session_store_unavailable" }, status: 503 };
      }
      if (
        startingRevision !== this.stateRevision ||
        currentRecord?.session?.refresh_token !== record.session.refresh_token
      ) {
        return { body: { error: "unauthenticated" }, status: 401 };
      }
      await this.state.storage.delete(RECORD_KEY);
      return { body: { error: "unauthenticated" }, status: 401 };
    }

    let refreshed: Record<string, unknown>;
    try {
      refreshed = (await refreshResponse.json()) as Record<string, unknown>;
    } catch {
      return { body: { error: "invalid_auth_response" }, status: 502 };
    }

    if (
      typeof refreshed.access_token !== "string" ||
      typeof refreshed.refresh_token !== "string" ||
      typeof refreshed.expires_in !== "number"
    ) {
      return { body: { error: "invalid_auth_response" }, status: 502 };
    }

    let currentRecord: SessionRecord | null;
    try {
      currentRecord = await this.readRecord();
    } catch {
      return { body: { error: "session_store_unavailable" }, status: 503 };
    }
    if (
      startingRevision !== this.stateRevision ||
      !currentRecord?.session ||
      currentRecord.session.refresh_token !== record.session.refresh_token
    ) {
      return { body: { error: "unauthenticated" }, status: 401 };
    }

    const refreshedUser =
      refreshed.user && typeof refreshed.user === "object"
        ? (refreshed.user as Record<string, unknown>)
        : null;
    const userId =
      typeof refreshedUser?.id === "string"
        ? refreshedUser.id
        : record.session.user.id;
    const email =
      typeof refreshedUser?.email === "string"
        ? refreshedUser.email
        : record.session.user.email;
    const session: StoredSession = {
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at:
        Math.floor(Date.now() / 1000) + Math.max(1, refreshed.expires_in),
      token_type:
        typeof refreshed.token_type === "string"
          ? refreshed.token_type
          : "bearer",
      user: { id: userId, email: email ?? null },
      isPasswordRecovery: record.session.isPasswordRecovery,
    };

    currentRecord.session = session;
    try {
      const encrypted = await this.encryptRecord(currentRecord);
      if (startingRevision !== this.stateRevision) {
        return { body: { error: "unauthenticated" }, status: 401 };
      }
      await this.state.storage.put(RECORD_KEY, encrypted);
      await this.state.storage.setAlarm(currentRecord.expires_at);
    } catch {
      return { body: { error: "session_store_unavailable" }, status: 503 };
    }
    return { body: { session }, status: 200 };
  }

  private async readRecord(): Promise<SessionRecord | null> {
    const startingRevision = this.stateRevision;
    const encrypted = await this.state.storage.get<string>(RECORD_KEY);
    if (!encrypted) return null;

    const record = await this.decryptRecord(encrypted);
    if (!this.isValidRecord(record) || record.expires_at <= Date.now()) {
      if (startingRevision === this.stateRevision) {
        await this.state.storage.delete(RECORD_KEY);
      }
      return null;
    }

    if (record.flow && record.flow.expires_at <= Date.now()) {
      delete record.flow;
      if (!record.session) {
        if (startingRevision === this.stateRevision) {
          await this.state.storage.delete(RECORD_KEY);
        }
        return null;
      }
    }
    return record;
  }

  private async writeRecord(record: SessionRecord): Promise<void> {
    const encrypted = await this.encryptRecord(record);
    await this.state.storage.put(RECORD_KEY, encrypted);
    await this.state.storage.setAlarm(record.expires_at);
  }

  private async encryptRecord(record: SessionRecord): Promise<string> {
    const key = await getEncryptionKey(this.env.SESSION_ENCRYPTION_KEY);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(record));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: ADDITIONAL_DATA },
      key,
      plaintext,
    );
    return `${bytesToBase64(iv)}.${bytesToBase64(new Uint8Array(ciphertext))}`;
  }

  private async decryptRecord(encrypted: string): Promise<SessionRecord> {
    const [encodedIv, encodedCiphertext] = encrypted.split(".");
    if (!encodedIv || !encodedCiphertext) {
      throw new Error("Invalid encrypted session record.");
    }
    const key = await getEncryptionKey(this.env.SESSION_ENCRYPTION_KEY);
    const plaintext = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: base64ToBytes(encodedIv),
        additionalData: ADDITIONAL_DATA,
      },
      key,
      base64ToBytes(encodedCiphertext),
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as SessionRecord;
  }

  private isValidRecord(value: unknown): value is SessionRecord {
    if (!value || typeof value !== "object") return false;
    const record = value as SessionRecord;
    if (!Number.isFinite(record.expires_at)) return false;
    if (record.session) {
      return (
        typeof record.session.access_token === "string" &&
        typeof record.session.refresh_token === "string" &&
        Number.isFinite(record.session.expires_at) &&
        typeof record.session.user?.id === "string"
      );
    }
    if (record.flow) {
      return (
        record.flow.type === "oauth" &&
        typeof record.flow.flow === "string" &&
        typeof record.flow.verifier === "string" &&
        typeof record.flow.next === "string" &&
        Number.isFinite(record.flow.expires_at)
      );
    }
    return true;
  }
}

export default {
  fetch() {
    return json({ error: "not_found" }, 404);
  },
};
