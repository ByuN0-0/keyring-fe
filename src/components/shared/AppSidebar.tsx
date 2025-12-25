'use client';

import { useState } from 'react';
import { vaultService } from '@/services/vaultService';
import { VaultScope } from '@/types';
import { ScopeType } from './DashboardContent';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Building2, FolderKanban, Globe, Plus, ChevronRight, ChevronDown, GripVertical, type LucideIcon, Hash, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface AppSidebarProps {
  activeType: ScopeType;
  activeScopeId: string | null;
  onScopeChange: (type: ScopeType, scopeId: string | null) => void;
  scopes: VaultScope[];
  onRefresh: () => void;
}

function SortableScopeItem({ 
  scope, 
  activeScopeId, 
  onScopeChange,
  activeType,
  onDelete
}: { 
  scope: VaultScope; 
  activeScopeId: string | null;
  onScopeChange: (type: ScopeType, scopeId: string | null) => void;
  activeType: ScopeType;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: scope.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/item flex items-center gap-2 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-all",
        activeScopeId === scope.id
          ? "text-indigo-600 bg-indigo-50/50 shadow-sm"
          : "text-slate-400 hover:text-slate-700 hover:bg-slate-50/50"
      )}
    >
      <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 -ml-2 text-slate-300 hover:text-slate-400">
        <GripVertical className="h-3.5 w-3.5" />
      </div>
      <button
        onClick={() => onScopeChange(activeType, scope.id)}
        className="flex flex-1 items-center gap-2.5 text-left"
      >
        <Hash className={cn("h-3.5 w-3.5", activeScopeId === scope.id ? "text-indigo-600" : "text-slate-300")} />
        {scope.scope_id}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (confirm('이 보관소와 내부의 모든 비밀값이 삭제됩니다. 계속하시겠습니까?')) {
            onDelete(scope.id);
          }
        }}
        className="opacity-0 group-hover/item:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-all"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AppSidebar({ 
  activeType, 
  activeScopeId, 
  onScopeChange,
  scopes,
  onRefresh
}: AppSidebarProps) {
  const [expandedTypes, setExpandedTypes] = useState<Record<ScopeType, boolean>>({
    provider: true,
    project: true,
    global: true
  });
  const [addingTo, setAddingTo] = useState<ScopeType | null>(null);
  const [newScopeName, setNewScopeName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const menuItems: { id: ScopeType; label: string; icon: LucideIcon }[] = [
    { id: 'provider', label: 'Cloud Providers', icon: Building2 },
    { id: 'project', label: 'Projects', icon: FolderKanban },
    { id: 'global', label: 'Global Vault', icon: Globe },
  ];

  const toggleExpand = (type: ScopeType) => {
    setExpandedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleAddScope = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScopeName || !addingTo) return;
    try {
      await vaultService.createScope(addingTo, newScopeName);
      setNewScopeName(''); setAddingTo(null); onRefresh();
      setExpandedTypes(prev => ({ ...prev, [addingTo]: true }));
    } catch (err) {
      console.error('Failed to add scope', err);
    }
  };

  const handleDeleteScope = async (id: string) => {
    try {
      await vaultService.deleteScope(id);
      if (activeScopeId === id) {
        onScopeChange(activeType, null);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to delete scope', err);
    }
  };

  const handleDragEnd = async (event: DragEndEvent, type: ScopeType) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const typeScopes = scopes.filter(s => s.scope === type);
      const oldIndex = typeScopes.findIndex(s => s.id === active.id);
      const newIndex = typeScopes.findIndex(s => s.id === over.id);
      
      const newTypeScopes = arrayMove(typeScopes, oldIndex, newIndex);
      const updatedOrders = newTypeScopes.map((s, idx) => ({ id: s.id, sort_order: idx }));
      
      try {
        await vaultService.updateScopeOrder(updatedOrders);
        onRefresh();
      } catch (err) {
        console.error('Failed to reorder scopes', err);
      }
    }
  };

  return (
    <aside className="w-72 border-r border-slate-100 bg-white p-6 overflow-y-auto">
      <div className="mb-10 px-4">
        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Vault Categories</h3>
      </div>
      
      <nav className="space-y-8">
        {menuItems.map((item) => {
          const categoryScopes = scopes.filter(s => s.scope === item.id);
          return (
            <div key={`category-${item.id}`} className="space-y-3">
              <div className="flex items-center justify-between group px-1">
                <button
                  onClick={() => {
                    if (item.id === 'global') {
                      onScopeChange(item.id, null);
                    } else {
                      toggleExpand(item.id);
                    }
                  }}
                  className={cn(
                    "flex flex-1 items-center gap-3 py-1.5 text-sm font-bold transition-all",
                    activeType === item.id && (item.id === 'global' ? activeScopeId === null : true)
                      ? "text-indigo-600"
                      : "text-slate-500 hover:text-slate-900"
                  )}
                >
                  <div className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-all",
                    activeType === item.id && (item.id === 'global' ? activeScopeId === null : true)
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-100"
                      : "bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600"
                  )}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id !== 'global' && (
                    expandedTypes[item.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                {item.id !== 'global' && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-slate-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingTo(addingTo === item.id ? null : item.id);
                    }}
                  >
                    <Plus className="h-4 w-4 text-slate-400" />
                  </Button>
                )}
              </div>
              
              {(item.id === 'global' || expandedTypes[item.id]) && (
                <div className="ml-4 border-l-2 border-slate-50 pl-4 space-y-1">
                  {addingTo === item.id && (
                    <form onSubmit={handleAddScope} className="mb-2">
                      <Input
                        autoFocus
                        placeholder="New scope name..."
                        className="h-9 text-xs bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-indigo-500/20"
                        value={newScopeName}
                        onChange={(e) => setNewScopeName(e.target.value)}
                        onBlur={() => !newScopeName && setAddingTo(null)}
                      />
                    </form>
                  )}

                  {item.id !== 'global' ? (
                    <DndContext
                      key={`dnd-${item.id}`}
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={(e) => handleDragEnd(e, item.id)}
                    >
                      <SortableContext
                        items={categoryScopes.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-1">
                          {categoryScopes.map((s) => (
                            <SortableScopeItem 
                              key={`scope-${s.id}`} 
                              scope={s} 
                              activeScopeId={activeScopeId} 
                              onScopeChange={onScopeChange}
                              activeType={item.id}
                              onDelete={handleDeleteScope}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  ) : null}
                  
                  {item.id !== 'global' && categoryScopes.length === 0 && !addingTo && (
                    <p key={`empty-${item.id}`} className="py-2 text-[11px] text-slate-300 font-medium italic pl-2">No items in this category</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}