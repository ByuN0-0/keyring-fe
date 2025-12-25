import { axiosClient } from "../lib/api/axiosClient";
import { VaultScope, VaultFragment } from "../types";

export const vaultService = {
  async getScopes(): Promise<{ scopes: VaultScope[] }> {
    const { data } = await axiosClient.get("/vault/scopes");
    return data;
  },

  async createScope(
    scope: string,
    scope_id: string | null
  ): Promise<{ id: string }> {
    const { data } = await axiosClient.post("/vault/scopes", {
      scope,
      scope_id,
    });
    return data;
  },

  async getFragments(): Promise<{ fragments: VaultFragment[] }> {
    const { data } = await axiosClient.get("/vault");
    return data;
  },

  async upsertFragment(payload: {
    scope_uuid: string;
    key_name: string;
    encrypted_blob: string;
    salt: string;
  }): Promise<{ success: boolean }> {
    const { data } = await axiosClient.post("/vault", payload);
    return data;
  },
};
