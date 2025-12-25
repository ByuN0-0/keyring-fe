import { axiosClient } from "../lib/api/axiosClient";
import { SessionInfo, User } from "../types";

export const authService = {
  async login(
    email: string,
    password: string
  ): Promise<{ user: User; expiresAt: number }> {
    const { data } = await axiosClient.post("/auth/login", { email, password });
    return data;
  },

  async logout(): Promise<void> {
    await axiosClient.post("/auth/logout");
  },

  async getMe(): Promise<SessionInfo> {
    const { data } = await axiosClient.get("/auth/me");
    return data;
  },
};
