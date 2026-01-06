export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Folder {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Secret {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  encrypted_blob: string;
  salt: string;
  created_at: string;
  updated_at: string;
}

export interface SessionInfo {
  user: User;
  expiresAt: number;
}
