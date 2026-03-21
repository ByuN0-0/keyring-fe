"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { encryptData, decryptData } from "@/lib/crypto";
import { authService } from "@/services/authService";
import { folderService } from "@/services/folderService";
import { secretService } from "@/services/secretService";
import { Folder, Secret, SessionInfo } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import {
  Plus,
  Eye,
  EyeOff,
  Key,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { v4 as uuidv4 } from "uuid";

export function DashboardContent() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [editState, setEditState] = useState<
    { id: string; name: string; value: string; isNew?: boolean }[]
  >([]);
  const router = useRouter();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [decryptedValues, setDecryptedValues] = useState<
    Record<string, string>
  >({});
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      const me = await authService.getMe();
      setSession(me);
      const { folders: folderData } = await folderService.getFolders();
      setFolders(folderData);
    } catch {
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const loadSecrets = useCallback(async () => {
    try {
      const { secrets: secretData } = await secretService.getSecrets(
        activeFolderId
      );
      setSecrets(secretData);
    } catch (e) {
      console.error("Failed to load secrets", e);
    }
  }, [activeFolderId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadInitialData(), loadSecrets()]);
  }, [loadInitialData, loadSecrets]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!isLoading) loadSecrets();
  }, [loadSecrets, isLoading]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
            <ShieldCheck className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-indigo-600" />
          </div>
          <p className="text-sm text-slate-500">Connecting to vault...</p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const currentFolder = folders.find((f) => f.id === activeFolderId);

  // Build breadcrumb path
  const buildBreadcrumb = () => {
    const path: string[] = [];
    let folderId: string | null = activeFolderId;
    while (folderId) {
      const folder = folders.find((f) => f.id === folderId);
      if (!folder) break;
      path.unshift(folder.name);
      folderId = folder.parent_id;
    }
    return path;
  };
  const breadcrumb = buildBreadcrumb();

  const handleDelete = async (id: string) => {
    if (!confirm("이 시크릿을 삭제하시겠습니까?")) return;
    try {
      await secretService.deleteSecret(id);
      loadSecrets();
    } catch {
      setError("삭제에 실패했습니다.");
    }
  };

  const handleDecrypt = async (secret: Secret) => {
    if (!passphrase) {
      setError("복호화하려면 마스터 패스프레이즈를 입력하세요.");
      return;
    }
    if (!secret.encrypted_blob || !secret.salt) return;
    try {
      const decrypted = await decryptData(
        secret.encrypted_blob,
        secret.salt,
        passphrase
      );
      setDecryptedValues((prev) => ({ ...prev, [secret.id]: decrypted }));
      setVisibleSecrets((prev) => ({ ...prev, [secret.id]: true }));
      setError("");
    } catch {
      setError("복호화 실패: 패스프레이즈가 틀렸습니다.");
    }
  };

  const handleAddEditRow = () => {
    setEditState((prev) => [
      ...prev,
      { id: uuidv4(), name: "", value: "", isNew: true },
    ]);
  };

  const handleStartEdit = async () => {
    if (!passphrase) {
      setError("수정하려면 마스터 패스프레이즈를 먼저 입력해주세요.");
      return;
    }
    setIsLoading(true);
    try {
      const newDecryptedValues = { ...decryptedValues };
      for (const item of secrets) {
        if (!newDecryptedValues[item.id] && item.encrypted_blob && item.salt) {
          try {
            const decrypted = await decryptData(
              item.encrypted_blob,
              item.salt,
              passphrase
            );
            newDecryptedValues[item.id] = decrypted;
          } catch {
            setError("일부 항목 복호화에 실패했습니다. 패스프레이즈를 확인하세요.");
            setIsLoading(false);
            return;
          }
        }
      }
      setDecryptedValues(newDecryptedValues);
      const initialEditState = secrets.map((item) => ({
        id: item.id,
        name: item.name,
        value: newDecryptedValues[item.id] || "",
        isNew: false,
      }));
      setEditState(initialEditState);
      setIsEditing(true);
      setError("");
    } catch (err) {
      console.error(err);
      setError("편집 모드 전환 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveBatch = async () => {
    if (!passphrase) {
      setError("마스터 패스프레이즈를 먼저 입력해주세요.");
      return;
    }
    setIsLoading(true);
    try {
      const currentIds = new Set(editState.map((e) => e.id));
      const itemsToDelete = secrets.filter((item) => !currentIds.has(item.id));
      for (const item of itemsToDelete) {
        await secretService.deleteSecret(item.id);
      }

      for (const editItem of editState) {
        if (!editItem.name || !editItem.value) continue;
        const { encrypted_blob, salt } = await encryptData(
          editItem.value,
          passphrase
        );
        if (editItem.isNew) {
          await secretService.createSecret({
            id: editItem.id,
            name: editItem.name,
            encrypted_blob,
            salt,
            folder_id: activeFolderId,
          });
        } else {
          const original = secrets.find((i) => i.id === editItem.id);
          const hasChanged =
            original?.name !== editItem.name ||
            decryptedValues[editItem.id] !== editItem.value;
          if (hasChanged) {
            await secretService.updateSecret(editItem.id, {
              name: editItem.name,
              encrypted_blob,
              salt,
              folder_id: activeFolderId,
            });
          }
        }
      }

      setIsEditing(false);
      setEditState([]);
      await loadSecrets();
      setError("");
    } catch (err) {
      console.error(err);
      setError("저장에 실패했습니다. 패스프레이즈를 확인하세요.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <AppHeader user={session.user} expiresAt={session.expiresAt} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          activeFolderId={activeFolderId}
          onFolderSelect={setActiveFolderId}
          folders={folders}
          onRefresh={refreshAll}
        />

        <main className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto max-w-4xl space-y-6">

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                {/* Breadcrumb */}
                {breadcrumb.length > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <span>All Secrets</span>
                    {breadcrumb.map((crumb, i) => (
                      <span key={i} className="flex items-center gap-1">
                        <ChevronRight className="h-3 w-3" />
                        <span>{crumb}</span>
                      </span>
                    ))}
                  </div>
                )}
                <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                  {currentFolder?.name || "All Secrets"}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <Button
                      onClick={handleAddEditRow}
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-indigo-600 hover:bg-indigo-50 border border-indigo-100"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setEditState([]);
                      }}
                      variant="ghost"
                      className="h-8 rounded-lg px-3 text-slate-500 hover:bg-slate-100 text-xs font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveBatch}
                      className="h-8 rounded-lg bg-indigo-600 font-medium text-white hover:bg-indigo-700 px-4 text-xs shadow-sm"
                    >
                      Save changes
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleStartEdit}
                    variant="outline"
                    className="h-8 rounded-lg px-4 border-slate-200 text-slate-600 font-medium hover:bg-slate-50 text-xs"
                  >
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Passphrase card */}
            <div
              className={cn(
                "flex flex-col md:flex-row items-center gap-4 rounded-xl bg-white border p-4 transition-all duration-300",
                passphrase
                  ? "border-emerald-200 border-l-2 border-l-emerald-500"
                  : "border-slate-200 border-l-2 border-l-indigo-400"
              )}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300",
                  passphrase
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-indigo-50 text-indigo-500"
                )}
              >
                {passphrase ? (
                  <ShieldCheck className="h-5 w-5" />
                ) : (
                  <ShieldAlert className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  Master Passphrase
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  암호화 및 복호화를 위한 키입니다. 서버에 저장되지 않습니다.
                </p>
              </div>
              <div className="w-full md:w-72">
                <Input
                  type="password"
                  placeholder="Enter passphrase to unlock"
                  className="h-9 bg-slate-50 border-slate-200 font-mono text-sm rounded-lg"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-600 border border-red-100">
                <ShieldAlert className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Secrets list */}
            <div className="space-y-1.5">
              {isEditing
                ? editState.map((editItem, index) => (
                    <div
                      key={editItem.id}
                      className="flex flex-col md:flex-row items-center gap-3 rounded-lg bg-white p-3 border border-slate-200"
                    >
                      <div className="flex-1 w-full">
                        <Input
                          placeholder="Key name"
                          className="h-9 rounded-lg bg-slate-50/50 border-slate-200 text-sm font-medium"
                          value={editItem.name}
                          onChange={(e) => {
                            const newState = [...editState];
                            newState[index].name = e.target.value;
                            setEditState(newState);
                          }}
                        />
                      </div>
                      <div className="flex-[1.5] w-full">
                        <Input
                          placeholder="Value"
                          className="h-9 rounded-lg bg-slate-50/50 border-slate-200 text-sm font-mono"
                          value={editItem.value}
                          onChange={(e) => {
                            const newState = [...editState];
                            newState[index].value = e.target.value;
                            setEditState(newState);
                          }}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setEditState((prev) =>
                            prev.filter((_, i) => i !== index)
                          )
                        }
                        className="h-9 w-9 text-slate-300 hover:text-red-500 rounded-lg shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                : secrets.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center justify-between rounded-lg bg-white p-3 border border-slate-100 hover:border-slate-200 hover:shadow-sm transition-all duration-150"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-colors">
                          <Key className="h-4 w-4" />
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-6 flex-1 min-w-0">
                          <div className="min-w-0 md:w-40">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">
                              Key
                            </p>
                            <h4 className="text-sm font-medium text-slate-800 truncate">
                              {item.name}
                            </h4>
                          </div>

                          <div className="flex items-center gap-2">
                            {decryptedValues[item.id] ? (
                              <div className="flex items-center gap-1.5">
                                <code className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-mono text-emerald-700 ring-1 ring-inset ring-emerald-600/10 max-w-xs truncate">
                                  {visibleSecrets[item.id]
                                    ? decryptedValues[item.id]
                                    : "••••••••••"}
                                </code>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setVisibleSecrets((prev) => ({
                                      ...prev,
                                      [item.id]: !prev[item.id],
                                    }));
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                >
                                  {visibleSecrets[item.id] ? (
                                    <EyeOff className="h-3.5 w-3.5" />
                                  ) : (
                                    <Eye className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDecrypt(item);
                                }}
                                className="text-[11px] font-medium text-indigo-500 hover:text-indigo-700 underline underline-offset-4 decoration-indigo-200 transition-colors"
                              >
                                Unlock
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item.id);
                          }}
                          className="h-7 w-7 text-slate-300 hover:text-red-500 rounded-md"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}

              {!isEditing && secrets.length === 0 && (
                <div className="py-20 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white">
                  <div className="h-14 w-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-4">
                    <Key className="h-6 w-6 text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">
                    No secrets in this folder
                  </p>
                  <p className="text-xs text-slate-300 mt-1">
                    Click Edit to add your first secret
                  </p>
                </div>
              )}

              {/* Secret count badge */}
              {!isEditing && secrets.length > 0 && (
                <div className="pt-2 flex justify-end">
                  <Badge
                    variant="secondary"
                    className="text-[11px] text-slate-400 bg-transparent border-0 px-0"
                  >
                    {secrets.length} secret{secrets.length !== 1 ? "s" : ""}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
