"use client";

import { useState } from "react";
import { vaultService } from "@/services/vaultService";
import { VaultScope } from "@/types";
import { ScopeType } from "./DashboardContent";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Building2,
  FolderKanban,
  Globe,
  Plus,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

interface AppSidebarProps {
  activeType: ScopeType;
  activeScopeId: string | null;
  onScopeChange: (type: ScopeType, scopeId: string | null) => void;
  scopes: VaultScope[];
  onRefresh: () => void;
}

export function AppSidebar({
  activeType,
  activeScopeId,
  onScopeChange,
  scopes,
  onRefresh,
}: AppSidebarProps) {
  const [addingTo, setAddingTo] = useState<ScopeType | null>(null);
  const [newScopeName, setNewScopeName] = useState("");

  const menuItems: { id: ScopeType; label: string; icon: LucideIcon }[] = [
    { id: "provider", label: "서비스 공급자", icon: Building2 },
    { id: "project", label: "프로젝트", icon: FolderKanban },
    { id: "global", label: "전역 설정", icon: Globe },
  ];

  const handleAddScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScopeName || !addingTo) return;

    try {
      await vaultService.createScope(addingTo, newScopeName);
      setNewScopeName("");
      setAddingTo(null);
      onRefresh();
    } catch (err) {
      console.error("Failed to add scope", err);
    }
  };

  return (
    <aside className="w-64 border-r bg-muted/30 p-4">
      <div className="mb-6 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Vault Storage
      </div>
      <nav className="space-y-6">
        {menuItems.map((item) => (
          <div key={item.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <button
                onClick={() => onScopeChange(item.id, null)}
                className={cn(
                  "flex flex-1 items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all",
                  activeType === item.id && activeScopeId === null
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon
                  className={cn(
                    "h-4 w-4",
                    activeType === item.id && activeScopeId === null
                      ? "text-primary"
                      : ""
                  )}
                />
                {item.label}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  setAddingTo(addingTo === item.id ? null : item.id)
                }
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {addingTo === item.id && (
              <form onSubmit={handleAddScope} className="ml-9 pr-1">
                <Input
                  autoFocus
                  placeholder="새 탭 이름"
                  className="h-8 text-xs"
                  value={newScopeName}
                  onChange={(e) => setNewScopeName(e.target.value)}
                  onBlur={() => !newScopeName && setAddingTo(null)}
                />
              </form>
            )}

            <div className="ml-9 space-y-1">
              {scopes
                .filter((s) => s.scope === item.id)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => onScopeChange(item.id, s.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                      activeScopeId === s.id
                        ? "text-primary bg-primary/10"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <ChevronRight
                      className={cn(
                        "h-3 w-3",
                        activeScopeId === s.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {s.scope_id}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
