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
import { Plus, Eye, EyeOff, Lock, Key } from "lucide-react";

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
  const router = useRouter();

  const activeScope = session?.scopes.find((s) => s.id === activeScopeId);

  const scopeNames: Record<ScopeType, string> = {
    provider: "서비스 공급자",
    project: "프로젝트",
    global: "전역 설정",
  };

  const refreshData = useCallback(async () => {
    try {
      const data = await authService.getMe();
      setSession(data);
    } catch (err) {
      console.error("Failed to refresh data", err);
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
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-foreground">
            보안 환경을 구성하는 중...
          </p>
        </div>
      </div>
    );
  }

  if (!session) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase) {
      setError("데이터 암호화를 위해 마스터 패스프레이즈를 먼저 입력해주세요.");
      return;
    }
    if (!activeScopeId) {
      setError("비밀값을 추가할 탭을 먼저 선택하거나 생성해주세요.");
      return;
    }
    try {
      const { encrypted_blob, salt } = await encryptData(newValue, passphrase);
      await vaultService.upsertFragment({
        scope_uuid: activeScopeId,
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
      setError("비밀값 저장에 실패했습니다.");
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
    if (!activeScopeId) {
      return (f.scope || "global") === activeType && !f.scope_id;
    }
    return f.scope_pk.startsWith(`${activeScopeId}:`);
  });

  return (
    <div className="flex h-screen flex-col bg-background">
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

        <main className="flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">
                  {scopeNames[activeType]}
                  {activeScope && (
                    <span className="text-primary ml-2">
                      › {activeScope.scope_id}
                    </span>
                  )}
                </h2>
                <p className="text-muted-foreground">
                  안전하게 보관된{" "}
                  {activeScope?.scope_id || scopeNames[activeType]}의 비밀값
                  목록입니다.
                </p>
              </div>
              <Button onClick={() => setIsAdding(!isAdding)}>
                <Plus className="mr-2 h-4 w-4" /> 항목 추가
              </Button>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20 font-medium">
                {error}
              </div>
            )}

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider">
                    마스터 패스프레이즈
                  </CardTitle>
                </div>
                <CardDescription>
                  암호화 및 복호화에 사용되며 서버에 저장되지 않습니다.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Input
                  type="password"
                  placeholder="패스프레이즈를 입력하세요"
                  className="max-w-md"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                />
              </CardContent>
            </Card>

            {isAdding && (
              <Card className="animate-in fade-in slide-in-from-top-4">
                <CardHeader>
                  <CardTitle className="text-lg">새로운 비밀값 생성</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={handleAdd}
                    className="grid grid-cols-1 gap-4 md:grid-cols-3"
                  >
                    <div className="space-y-2">
                      <Label>키 이름</Label>
                      <Input
                        placeholder="예: API_KEY"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>값</Label>
                      <div className="relative">
                        <Input
                          type={showNewValue ? "text" : "password"}
                          placeholder="비밀값 입력"
                          value={newValue}
                          onChange={(e) => setNewValue(e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewValue(!showNewValue)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showNewValue ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" className="w-full">
                        저장
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <Card>
              <div className="border-b px-6 py-4 bg-muted/50">
                <div className="grid grid-cols-12 gap-4 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <div className="col-span-4">키 이름</div>
                  <div className="col-span-6">데이터</div>
                  <div className="col-span-2 text-right">작업</div>
                </div>
              </div>
              <div className="divide-y">
                {filteredFragments.map((f) => (
                  <div
                    key={f.scope_pk}
                    className="grid grid-cols-12 items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                  >
                    <div className="col-span-4 font-mono text-sm font-semibold">
                      {f.scope_pk.split(":")[1] || f.scope_pk}
                    </div>
                    <div className="col-span-6 flex items-center gap-3">
                      {decryptedValues[f.scope_pk] ? (
                        <>
                          <Badge variant="secondary" className="font-mono py-1">
                            {visibleSecrets[f.scope_pk]
                              ? decryptedValues[f.scope_pk]
                              : "••••••••••••"}
                          </Badge>
                          <button
                            onClick={() =>
                              setVisibleSecrets((prev) => ({
                                ...prev,
                                [f.scope_pk]: !prev[f.scope_pk],
                              }))
                            }
                            className="text-muted-foreground hover:text-foreground"
                          >
                            {visibleSecrets[f.scope_pk] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </>
                      ) : (
                        <div className="flex gap-1">
                          {[...Array(6)].map((_, i) => (
                            <div
                              key={i}
                              className="h-1 w-1 rounded-full bg-muted-foreground/30"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-right">
                      {!decryptedValues[f.scope_pk] && (
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => handleDecrypt(f)}
                        >
                          <Key className="mr-2 h-3 w-3" /> 복호화
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {filteredFragments.length === 0 && (
                  <div className="py-20 text-center text-muted-foreground text-sm">
                    저장된 비밀값이 없습니다.
                  </div>
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
