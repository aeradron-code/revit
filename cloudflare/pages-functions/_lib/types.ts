export interface DurableObjectNamespaceLike {
  idFromName(name: string): unknown;
  get(id: unknown): DurableObjectStubLike;
}

export interface DurableObjectStubLike {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface PagesEnv {
  APP_ALLOWED_ORIGINS?: string;
  APP_ORIGIN: string;
  SESSION_STORE: DurableObjectNamespaceLike;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_URL: string;
}

export interface PagesContext {
  request: Request;
  env: PagesEnv;
  params?: Record<string, string | string[] | undefined>;
}

export interface AuthUser {
  id: string;
  email?: string | null;
}

export interface StoredSession {
  access_token: string;
  expires_at: number;
  refresh_token: string;
  token_type: string;
  user: AuthUser;
  isPasswordRecovery?: boolean;
}

export interface StoredAuthFlow {
  expires_at: number;
  flow: string;
  next: string;
  type: "oauth";
  verifier: string;
}

export interface SessionRecord {
  expires_at: number;
  flow?: StoredAuthFlow;
  session?: StoredSession;
}
