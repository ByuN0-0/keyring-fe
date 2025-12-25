"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { encryptData, decryptData } from "@/lib/crypto";
import { authService } from "@/services/authService";
import { vaultService } from "@/services/vaultService";
import { VaultFragment, SessionInfo } from "@/types";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
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
  Search,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ScopeType = "provider" | "project" | "global";

export function DashboardContent() {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeType, setActiveType] = useState<ScopeType>("provider");
  const [activeScopeId, setActiveScopeId] = useState<string | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [showNewValue, setShowNewValue] = useState(false);
  const [decryptedValues, setDecryptedValues] = useState<
    Record<string, string>
  >({});
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  const refreshData = useCallback(async () => {
    try {
      const data = await authService.getMe();
      setSession(data);
    } catch {
      router.push("/login");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

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

  const activeScope = session.scopes.find((s) => s.id === activeScopeId);
  const scopeNames: Record<ScopeType, string> = {
    provider: "Service Providers",
    project: "Development Projects",
    global: "Global Settings",
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      setError("마스터 패스프레이즈를 먼저 입력해주세요.");
      return;
    }
    try {
      const { encrypted_blob, salt } = await encryptData(newValue, passphrase);
      await vaultService.upsertFragment({
        scope_uuid: activeScopeId!,
        key_name: newKey,
        encrypted_blob,
        salt,
      });
      setNewKey("");
      setNewValue("");
      setIsAdding(false);
      refreshData();
      setError("");
    } catch {
      setError("저장에 실패했습니다. 패스프레이즈를 확인하세요.");
    }
  };

  const handleDecrypt = async (fragment: VaultFragment) => {
    if (!passphrase) {
      setError("비밀값을 복호화하려면 마스터 패스프레이즈가 필요합니다.");
      return;
    }
    try {
      const decrypted = await decryptData(
        fragment.encrypted_blob,
        fragment.salt,
        passphrase
      );
      setDecryptedValues((prev) => ({
        ...prev,
        [fragment.scope_pk]: decrypted,
      }));
      setVisibleSecrets((prev) => ({ ...prev, [fragment.scope_pk]: true }));
      setError("");
    } catch {
      setError("복호화 실패: 패스프레이즈가 틀렸습니다.");
    }
  };

  const filteredFragments = session.fragments.filter((f) => {
    const matchesScope = activeScopeId
      ? f.scope_pk.startsWith(`${activeScopeId}:`)
      : (f.scope || "global") === activeType && !f.scope_id;
    const matchesSearch = f.scope_pk
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    return matchesScope && matchesSearch;
  });

  return (
    <div className="flex h-screen flex-col bg-[#F8FAFC] text-slate-900">
      <AppHeader user={session.user} expiresAt={session.expiresAt} />

      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          activeType={activeType}
          activeScopeId={activeScopeId}
          onScopeChange={(type, id) => {
            setActiveType(type);
            setActiveScopeId(id);
          }}
          scopes={session.scopes}
          onRefresh={refreshData}
        />

        <main className="flex-1 overflow-y-auto px-10 py-12">
          <div className="mx-auto max-w-5xl space-y-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Badge
                    variant="secondary"
                    className="bg-indigo-50 text-indigo-700 border-indigo-100 px-2 py-0.5 font-bold uppercase tracking-tighter text-[10px]"
                  >
                    {activeType}
                  </Badge>
                </div>
                <h2 className="text-4xl font-black tracking-tight text-slate-900">
                  {activeScope?.scope_id || scopeNames[activeType]}
                </h2>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
                  <Input
                    placeholder="Search secrets..."
                    className="w-64 pl-10 bg-white border-slate-200 focus:ring-indigo-500 rounded-xl"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => setIsAdding(!isAdding)}
                  className="rounded-xl bg-indigo-600 px-6 font-bold text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700"
                >
                  <Plus className="mr-2 h-4 w-4" /> Add Item
                </Button>
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

            {isAdding && (
              <Card className="border-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-300 overflow-hidden rounded-2xl">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-xl font-black tracking-tight">
                    Create New Secret
                  </CardTitle>
                  <CardDescription>
                    새로운 비밀번호나 API 키를 안전하게 저장합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-8">
                  <form
                    onSubmit={handleAdd}
                    className="grid grid-cols-1 gap-8 md:grid-cols-12"
                  >
                    <div className="md:col-span-5 space-y-2.5">
                      <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Key Name
                      </Label>
                      <Input
                        placeholder="AWS_SECRET_KEY"
                        className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        required
                      />
                    </div>
                    <div className="md:col-span-5 space-y-2.5">
                      <Label className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                        Value
                      </Label>
                      <div className="relative">
                        <Input
                          type={showNewValue ? "text" : "password"}
                          placeholder="Enter sensitive data"
                          className="h-12 rounded-xl bg-slate-50 border-slate-100 focus:bg-white pr-12"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewValue(!showNewValue)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600"
                        >
                          {showNewValue ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <Button
                        type="submit"
                        className="h-12 w-full rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                      >
                        Encrypt
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h4 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                  Secure Items ({filteredFragments.length})
                </h4>
              </div>

              <div className="grid gap-4">
                {filteredFragments.map((f) => (
                  <div
                    key={f.scope_pk}
                    className="group flex items-center justify-between rounded-3xl bg-white p-6 shadow-sm border border-slate-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300"
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                        <Key className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Key Identifier
                        </p>
                        <h4 className="text-base font-bold text-slate-900 font-mono">
                          {f.scope_pk.split(":")[1] || f.scope_pk}
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        {decryptedValues[f.scope_pk] ? (
                          <div className="flex items-center gap-3">
                            <code className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              {visibleSecrets[f.scope_pk]
                                ? decryptedValues[f.scope_pk]
                                : "••••••••••••"}
                            </code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg"
                              onClick={() =>
                                setVisibleSecrets((prev) => ({
                                  ...prev,
                                  [f.scope_pk]: !prev[f.scope_pk],
                                }))
                              }
                            >
                              {visibleSecrets[f.scope_pk] ? (
                                <EyeOff className="h-4 w-4 text-slate-400" />
                              ) : (
                                <Eye className="h-4 w-4 text-slate-400" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-1.5 opacity-30 px-4">
                            {[...Array(6)].map((_, i) => (
                              <div
                                key={i}
                                className="h-1.5 w-1.5 rounded-full bg-slate-400"
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 border-l border-slate-100 pl-6">
                        {!decryptedValues[f.scope_pk] ? (
                          <Button
                            size="sm"
                            onClick={() => handleDecrypt(f)}
                            className="rounded-xl bg-white text-indigo-600 border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all font-bold px-4"
                          >
                            Unlock
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-slate-300 hover:text-red-500 rounded-xl"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                {filteredFragments.length === 0 && (
                  <div className="py-24 flex flex-col items-center justify-center rounded-[40px] border-2 border-dashed border-slate-200 bg-white">
                    <div className="h-20 w-20 rounded-full bg-slate-50 flex items-center justify-center mb-6">
                      <Search className="h-8 w-8 text-slate-200" />
                    </div>
                    <p className="text-slate-400 font-bold">
                      No secrets found in this vault.
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
