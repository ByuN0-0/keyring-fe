import { axiosClient } from "../lib/api/axiosClient";
import { Secret } from "../types";

export const secretService = {
  async getSecrets(folderId?: string | null): Promise<{ secrets: Secret[] }> {
    const params = folderId ? { folderId } : {};
    const { data } = await axiosClient.get("/secrets", { params });
    return data;
  },

  async createSecret(secret: Partial<Secret>): Promise<{ success: boolean }> {
    const { data } = await axiosClient.post("/secrets", secret);
    return data;
  },

  async updateSecret(
    id: string,
    secret: Partial<Secret>
  ): Promise<{ success: boolean }> {
    const { data } = await axiosClient.put(`/secrets/${id}`, secret);
    return data;
  },

  async deleteSecret(id: string): Promise<{ success: boolean }> {
    const { data } = await axiosClient.delete(`/secrets/${id}`);
    return data;
  },
};
