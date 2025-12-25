export interface User {
  id: string;
  name: string;
  email: string;
}

export interface SessionInfo {
  user: User;
  expiresAt: number;
  fragments: VaultFragment[];
  scopes: VaultScope[];
}

export interface VaultScope {
  id: string;
  scope: 'global' | 'provider' | 'project';
  scope_id: string | null;
  sort_order: number;
}

export interface VaultFragment {
  scope_pk: string;
  user_id: string;
  encrypted_blob: string;
  salt: string;
  updated_at: string;
  scope?: string;
  scope_id?: string | null;
}
