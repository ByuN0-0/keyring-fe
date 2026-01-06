import { axiosClient } from "../lib/api/axiosClient";
import { Folder } from "../types";

export const folderService = {
  async getFolders(parentId?: string | null): Promise<{ folders: Folder[] }> {
    const params = parentId ? { parentId } : {};
    const { data } = await axiosClient.get("/folders", { params });
    return data;
  },

  async createFolder(folder: Partial<Folder>): Promise<{ success: boolean }> {
    const { data } = await axiosClient.post("/folders", folder);
    return data;
  },

  async updateFolder(
    id: string,
    folder: Partial<Folder>
  ): Promise<{ success: boolean }> {
    const { data } = await axiosClient.put(`/folders/${id}`, folder);
    return data;
  },

  async deleteFolder(id: string): Promise<{ success: boolean }> {
    const { data } = await axiosClient.delete(`/folders/${id}`);
    return data;
  },
};
