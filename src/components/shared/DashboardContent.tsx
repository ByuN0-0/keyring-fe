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
import { Card, CardContent } from "@/components/ui/Card";
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

  const refreshData = useCallback(async () => {
    try {
      const me = await authService.getMe();
      setSession(me);

      const { folders: folderData } = await folderService.getFolders();
      setFolders(folderData);

      const { secrets: secretData } = await secretService.getSecrets(
        activeFolderId
      );
      setSecrets(secretData);
    } catch {
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  }, [router, activeFolderId]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-[3px] border-slate-200 border-t-indigo-600"></div>
            <ShieldCheck className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-indigo-600" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-slate-900">
              보안 컨테이너 연결 중
            </h3>
            <p className="text-sm text-slate-500 font-medium">
              암호화된 볼트를 해독할 준비를 하고 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const currentFolder = folders.find((f) => f.id === activeFolderId);

  const filteredItems = secrets; // Now fetched specifically for activeFolderId

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    try {
      await secretService.deleteSecret(id);
      refreshData();
    } catch {
      setError("삭제에 실패했습니다.");
    }
  };

  const handleDecrypt = async (secret: Secret) => {
    if (!passphrase) {
      setError("비밀값을 복호화하려면 마스터 패스프레이즈가 필요합니다.");
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
      setError("비밀번호 수정을 위해 마스터 패스프레이즈를 먼저 입력해주세요.");
      return;
    }

    setIsLoading(true);
    try {
      const newDecryptedValues = { ...decryptedValues };

      // Decrypt all items in the current view that aren't already decrypted
      for (const item of filteredItems) {
        if (!newDecryptedValues[item.id] && item.encrypted_blob && item.salt) {
          try {
            const decrypted = await decryptData(
              item.encrypted_blob,
              item.salt,
              passphrase
            );
            newDecryptedValues[item.id] = decrypted;
          } catch {
            // If one fails, we might have a wrong passphrase
            setError(
              "일부 항목 복호화에 실패했습니다. 패스프레이즈를 확인하세요."
            );
            setIsLoading(false);
            return;
          }
        }
      }

      setDecryptedValues(newDecryptedValues);
      const initialEditState = filteredItems.map((item) => ({
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
      // 1. Determine deletions
      const currentIds = new Set(editState.map((e) => e.id));
      const itemsToDelete = filteredItems.filter(
        (item) => !currentIds.has(item.id)
      );

      for (const item of itemsToDelete) {
        await secretService.deleteSecret(item.id);
      }

      // 2. Add or Update
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
          const original = filteredItems.find((i) => i.id === editItem.id);
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
      await refreshData();
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
          onRefresh={refreshData}
        />

        <main className="flex-1 overflow-y-auto px-10 py-12">
          <div className="mx-auto max-w-5xl space-y-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5 font-bold">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Badge
                    variant="secondary"
                    className="bg-indigo-50 text-indigo-700 border-indigo-100 px-2 py-0.5 font-bold uppercase tracking-tighter text-[10px]"
                  >
                    {currentFolder ? "Folder" : "Root"}
                  </Badge>
                </div>
                <h2 className="text-4xl font-black tracking-tight text-slate-900">
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
                      className="rounded-xl h-10 w-10 text-indigo-600 hover:bg-indigo-50 border border-indigo-100"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                    <Button
                      onClick={() => {
                        setIsEditing(false);
                        setEditState([]);
                      }}
                      variant="ghost"
                      className="h-10 rounded-xl px-4 text-slate-500 hover:bg-slate-100 text-xs font-bold"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveBatch}
                      className="h-10 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 px-6 text-xs shadow-md"
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleStartEdit}
                    variant="outline"
                    className="h-10 rounded-xl px-6 border-indigo-100 text-indigo-600 font-bold hover:bg-indigo-50 transition-all text-sm"
                  >
                    Modify
                  </Button>
                )}
              </div>
            </div>

            <Card
              className={cn(
                "border-none shadow-xl transition-all duration-500 overflow-hidden",
                passphrase
                  ? "ring-2 ring-emerald-500/20"
                  : "ring-2 ring-indigo-500/10"
              )}
            >
              <div
                className={cn(
                  "h-1.5 w-full transition-all duration-500",
                  passphrase ? "bg-emerald-500" : "bg-indigo-500"
                )}
              />
              <CardContent className="flex flex-col md:flex-row items-center gap-6 p-8">
                <div
                  className={cn(
                    "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl transition-all duration-500",
                    passphrase
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-indigo-50 text-indigo-600"
                  )}
                >
                  {passphrase ? (
                    <ShieldCheck className="h-7 w-7" />
                  ) : (
                    <ShieldAlert className="h-7 w-7" />
                  )}
                </div>
                <div className="flex-1 space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">
                    Master Passphrase
                  </h3>
                  <p className="text-sm text-slate-500 font-medium">
                    암호화 및 복호화를 위한 유일한 열쇠입니다. 본인 외에는
                    누구도 알 수 없습니다.
                  </p>
                </div>
                <div className="w-full md:w-80">
                  <Input
                    type="password"
                    placeholder="Enter passphrase to unlock"
                    className="h-12 bg-slate-50 border-none font-mono text-lg rounded-xl focus:ring-2"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-center gap-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-600 border border-red-100 animate-in fade-in slide-in-from-top-2">
                <ShieldAlert className="h-4 w-4" /> {error}
              </div>
            )}

            <div className="space-y-4">
              <div className="grid gap-2">
                {isEditing
                  ? editState.map((editItem, index) => (
                      <div
                        key={editItem.id}
                        className="group flex flex-col md:flex-row items-center gap-4 rounded-2xl bg-white p-4 shadow-sm border border-indigo-100 animate-in fade-in duration-200"
                      >
                        <div className="flex-1 w-full space-y-1.5">
                          <Input
                            placeholder="Key Name"
                            className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-sm font-bold"
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
                            className="h-10 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all text-[13px]"
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
                          onClick={() => {
                            setEditState((prev) =>
                              prev.filter((_, i) => i !== index)
                            );
                          }}
                          className="h-10 w-10 text-slate-300 hover:text-red-500 rounded-xl shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  : filteredItems.map((item) => (
                      <div
                        key={item.id}
                        className="group flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm border border-slate-100 hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl group-hover:scale-105 transition-transform bg-indigo-50 text-indigo-500">
                            <Key className="h-4.5 w-4.5" />
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-w-0 items-center">
                            <div className="min-w-0">
                              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                                Secret
                              </p>
                              <h4 className="text-sm font-bold text-slate-800 truncate">
                                {item.name}
                              </h4>
                            </div>

                            <div className="flex items-center gap-2 group/value">
                              {decryptedValues[item.id] ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <code className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-mono font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/10 truncate">
                                    {visibleSecrets[item.id]
                                      ? decryptedValues[item.id]
                                      : "••••••••••••"}
                                  </code>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVisibleSecrets((prev) => ({
                                        ...prev,
                                        [item.id]: !prev[item.id],
                                      }));
                                    }}
                                    className="p-1 text-slate-400 hover:text-indigo-600 rounded-md hover:bg-slate-50 transition-colors"
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
                                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4 decoration-indigo-200"
                                >
                                  Unlock Value
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-4 border-l border-slate-50 pl-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(item.id);
                            }}
                            className="h-8 w-8 text-slate-300 hover:text-red-500 rounded-lg"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                {!isEditing && filteredItems.length === 0 && (
                  <div className="py-24 flex flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-slate-200 bg-white">
                    <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-6 text-slate-200">
                      <Key className="h-8 w-8" />
                    </div>
                    <p className="text-slate-400 font-bold">
                      No secrets in this folder.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
