import { folderService } from "@/services/folderService";
import { Folder } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Folder as FolderIcon,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Home,
  GripVertical,
} from "lucide-react";
import {
  DndContext,
  pointerWithin,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  CollisionDetection,
} from "@dnd-kit/core";
import { useState, useRef, useEffect, useCallback } from "react";

type DropPosition = "before" | "after" | "inside" | null;

interface AppSidebarProps {
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  folders: Folder[];
  onFoldersChange: (folders: Folder[]) => void;
  onRefresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function isDescendant(
  folders: Folder[],
  ancestorId: string,
  targetId: string
): boolean {
  let current: string | null = targetId;
  while (current) {
    if (current === ancestorId) return true;
    const folder = folders.find((f) => f.id === current);
    current = folder?.parent_id || null;
  }
  return false;
}

function computeOptimisticFolders(
  folders: Folder[],
  activeId: string,
  overId: string,
  position: DropPosition
): {
  newFolders: Folder[];
  updates: { id: string; parent_id: string | null; sort_order: number }[];
} {
  const activeNode = folders.find((f) => f.id === activeId)!;
  const overNode = folders.find((f) => f.id === overId)!;

  if (position === "inside") {
    const targetChildren = folders
      .filter((f) => f.parent_id === overNode.id && f.id !== activeNode.id)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const newSortOrder = targetChildren.length;

    const updates = [
      { id: activeNode.id, parent_id: overNode.id, sort_order: newSortOrder },
    ];
    const newFolders = folders.map((f) =>
      f.id === activeNode.id
        ? { ...f, parent_id: overNode.id, sort_order: newSortOrder }
        : f
    );
    return { newFolders, updates };
  }

  // before / after
  const targetParentId = overNode.parent_id;
  const siblings = folders
    .filter((f) => f.parent_id === targetParentId && f.id !== activeNode.id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const overIndex = siblings.findIndex((f) => f.id === overNode.id);
  const insertIndex = position === "before" ? overIndex : overIndex + 1;

  const newSiblings = [
    ...siblings.slice(0, insertIndex),
    activeNode,
    ...siblings.slice(insertIndex),
  ];

  const updates = newSiblings.map((f, index) => ({
    id: f.id,
    parent_id: targetParentId,
    sort_order: index,
  }));

  const updateMap = new Map(updates.map((u) => [u.id, u]));
  const newFolders = folders.map((f) => {
    const update = updateMap.get(f.id);
    if (update)
      return { ...f, parent_id: update.parent_id, sort_order: update.sort_order };
    return f;
  });

  return { newFolders, updates };
}

// Custom collision: pointerWithin first, closestCenter fallback
const treeCollision: CollisionDetection = (args) => {
  const pointer = pointerWithin(args);
  if (pointer.length > 0) return pointer;
  return closestCenter(args);
};

// ─── NavItem ──────────────────────────────────────────────────

function NavItem({
  folder,
  activeFolderId,
  onFolderSelect,
  allFolders,
  onDelete,
  onRefresh,
  expandedIds,
  onToggleExpand,
  dropTarget,
  isOverlay = false,
}: {
  folder: Folder;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  allFolders: Folder[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  dropTarget: { id: string; position: DropPosition } | null;
  isOverlay?: boolean;
}) {
  const isExpanded = expandedIds.has(folder.id);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  // useDraggable — no item shifting
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: folder.id,
    disabled: isOverlay,
  });

  // useDroppable — register as drop target
  const { setNodeRef: setDropRef } = useDroppable({
    id: folder.id,
  });

  // Combine refs
  const setNodeRef = useCallback(
    (el: HTMLElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

  const isDropTarget = dropTarget?.id === folder.id;
  const dropPosition = isDropTarget ? dropTarget.position : null;

  const children = allFolders
    .filter((f) => f.parent_id === folder.id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(folder.id);
  };

  const handleSelect = () => {
    onFolderSelect(folder.id);
    if (!isExpanded && children.length > 0) onToggleExpand(folder.id);
  };

  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim()) return;
    try {
      const parentChildren = allFolders.filter(
        (f) => f.parent_id === folder.id
      );
      const maxSortOrder = Math.max(
        0,
        ...parentChildren.map((f) => f.sort_order || 0)
      );
      await folderService.createFolder({
        name: newSubName.trim(),
        parent_id: folder.id,
        sort_order: maxSortOrder + 1,
      });
      setNewSubName("");
      setIsAddingSub(false);
      if (!isExpanded) onToggleExpand(folder.id);
      onRefresh();
    } catch (err) {
      console.error("Failed to add subfolder", err);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === folder.name) {
      setIsEditing(false);
      setEditName(folder.name);
      return;
    }
    try {
      await folderService.updateFolder(folder.id, { name: trimmed });
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to rename folder", err);
      setEditName(folder.name);
      setIsEditing(false);
    }
  };

  const startEditing = () => {
    setEditName(folder.name);
    setIsEditing(true);
  };

  const startAddSub = () => {
    setIsAddingSub(true);
    if (!isExpanded) onToggleExpand(folder.id);
  };

  const isActive = activeFolderId === folder.id;

  // Depth for indentation
  let depth = 0;
  let pid = folder.parent_id;
  while (pid) {
    depth++;
    const p = allFolders.find((f) => f.id === pid);
    pid = p?.parent_id || null;
  }

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      data-folder-id={folder.id}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group relative flex items-center gap-1 rounded-md py-1.25 pr-2 text-[13px] transition-colors cursor-pointer",
              isActive
                ? "bg-slate-100 text-slate-900 font-medium"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              isOverlay &&
                "bg-white/95 shadow-[0_4px_16px_rgba(0,0,0,0.12)] ring-1 ring-slate-200/80 rounded-md",
              dropPosition === "inside" &&
                "bg-indigo-50/70 ring-1 ring-indigo-300"
            )}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            onClick={handleSelect}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEditing();
            }}
          >
            {dropPosition === "before" && (
              <div className="drop-indicator -top-px" />
            )}
            {dropPosition === "after" && (
              <div className="drop-indicator -bottom-px" />
            )}

            {/* Drag handle */}
            <div
              {...attributes}
              {...listeners}
              className="opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-opacity shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3 w-3" />
            </div>

            {/* Chevron */}
            <div className="flex items-center justify-center w-3.5 h-3.5 shrink-0">
              {children.length > 0 ? (
                <button
                  onClick={handleToggle}
                  className="p-0.5 hover:bg-slate-200/80 rounded transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              ) : (
                <span className="w-3 h-3" />
              )}
            </div>

            {/* Icon */}
            {isExpanded && children.length > 0 ? (
              <FolderOpen
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isActive ? "text-indigo-500" : "text-slate-400"
                )}
              />
            ) : (
              <FolderIcon
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isActive ? "text-indigo-500" : "text-slate-400"
                )}
              />
            )}

            {/* Name */}
            {isEditing ? (
              <form
                onSubmit={handleRename}
                className="flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  autoFocus
                  className="h-5 py-0 px-1 text-[13px] rounded border-slate-200 focus:ring-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => {
                    setIsEditing(false);
                    setEditName(folder.name);
                  }}
                />
              </form>
            ) : (
              <span className="flex-1 truncate text-[13px]">{folder.name}</span>
            )}

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startAddSub();
                }}
                className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-200/60 rounded transition-all"
              >
                <Plus className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm("이 폴더를 삭제하시겠습니까?"))
                    onDelete(folder.id);
                }}
                className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-44">
          <ContextMenuItem className="cursor-pointer" onSelect={startEditing}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem className="cursor-pointer" onSelect={startAddSub}>
            New Subfolder
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
            onSelect={() => {
              if (confirm("이 폴더를 삭제하시겠습니까?")) onDelete(folder.id);
            }}
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Subfolder input */}
      {isAddingSub && (
        <div style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}>
          <form onSubmit={handleAddSub} className="pr-2 mb-0.5">
            <Input
              autoFocus
              placeholder="Subfolder name..."
              className="h-6 text-[12px] rounded border-slate-200 bg-white"
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              onBlur={() => !newSubName && setIsAddingSub(false)}
            />
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Flat tree renderer ───────────────────────────────────────

function renderFolderTree(
  folders: Folder[],
  parentId: string | null,
  expandedIds: Set<string>,
  props: {
    activeFolderId: string | null;
    onFolderSelect: (folderId: string | null) => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
    onToggleExpand: (id: string) => void;
    dropTarget: { id: string; position: DropPosition } | null;
  }
): React.ReactNode[] {
  const children = folders
    .filter((f) => f.parent_id === parentId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const nodes: React.ReactNode[] = [];
  for (const folder of children) {
    nodes.push(
      <NavItem
        key={folder.id}
        folder={folder}
        activeFolderId={props.activeFolderId}
        onFolderSelect={props.onFolderSelect}
        allFolders={folders}
        onDelete={props.onDelete}
        onRefresh={props.onRefresh}
        expandedIds={expandedIds}
        onToggleExpand={props.onToggleExpand}
        dropTarget={props.dropTarget}
      />
    );
    if (expandedIds.has(folder.id)) {
      nodes.push(
        ...renderFolderTree(folders, folder.id, expandedIds, props)
      );
    }
  }
  return nodes;
}

// ─── AppSidebar ───────────────────────────────────────────────

export function AppSidebar({
  activeFolderId,
  onFolderSelect,
  folders,
  onFoldersChange,
  onRefresh,
}: AppSidebarProps) {
  const [isAddingRoot, setIsAddingRoot] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: DropPosition;
  } | null>(null);

  // Auto-expand timer
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hoverExpandTargetRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (hoverExpandTimerRef.current)
        clearTimeout(hoverExpandTimerRef.current);
    };
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  // ─── Drag handlers ───────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setDropTarget(null);
      return;
    }

    // Live DOM rect
    const el = document.querySelector(`[data-folder-id="${over.id}"]`);
    if (!el) {
      setDropTarget(null);
      return;
    }
    const rect = el.getBoundingClientRect();

    // Live pointer Y
    const pointerY =
      (event.activatorEvent as MouseEvent).clientY + event.delta.y;
    const relativeY = pointerY - rect.top;
    const height = rect.height;

    // 30% before / 40% inside / 30% after
    let position: DropPosition;
    if (relativeY < height * 0.3) {
      position = "before";
    } else if (relativeY > height * 0.7) {
      position = "after";
    } else {
      position = "inside";
    }

    // Prevent dropping into own descendants
    if (
      position === "inside" &&
      isDescendant(folders, active.id as string, over.id as string)
    ) {
      position = "after";
    }

    // Auto-expand on hover (600ms) — only reset when target changes
    const overId = over.id as string;
    if (position === "inside") {
      if (hoverExpandTargetRef.current !== overId) {
        if (hoverExpandTimerRef.current)
          clearTimeout(hoverExpandTimerRef.current);
        hoverExpandTargetRef.current = overId;
        hoverExpandTimerRef.current = setTimeout(() => {
          const hasChildren = folders.some((f) => f.parent_id === overId);
          if (hasChildren) {
            setExpandedIds((prev) => new Set([...prev, overId]));
          }
          hoverExpandTimerRef.current = null;
          hoverExpandTargetRef.current = null;
        }, 600);
      }
    } else {
      if (hoverExpandTimerRef.current) {
        clearTimeout(hoverExpandTimerRef.current);
        hoverExpandTimerRef.current = null;
      }
      hoverExpandTargetRef.current = null;
    }

    setDropTarget({ id: overId, position });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDropTarget = dropTarget;

    // Cleanup
    if (hoverExpandTimerRef.current)
      clearTimeout(hoverExpandTimerRef.current);
    hoverExpandTimerRef.current = null;
    hoverExpandTargetRef.current = null;
    setActiveId(null);
    setDropTarget(null);

    if (!over || !currentDropTarget) return;

    const activeNode = folders.find((f) => f.id === active.id);
    const overNode = folders.find((f) => f.id === currentDropTarget.id);

    if (!activeNode || !overNode || active.id === over.id) return;

    const position = currentDropTarget.position;

    // Prevent circular move
    if (
      position === "inside" &&
      isDescendant(folders, activeNode.id, overNode.id)
    ) {
      return;
    }

    // Optimistic update
    const { newFolders, updates } = computeOptimisticFolders(
      folders,
      activeNode.id,
      overNode.id,
      position
    );

    onFoldersChange(newFolders);

    if (position === "inside") {
      setExpandedIds((prev) => new Set([...prev, overNode.id]));
    }

    // Background API — revert on failure
    Promise.all(
      updates.map((u) =>
        folderService.updateFolder(u.id, {
          parent_id: u.parent_id,
          sort_order: u.sort_order,
        })
      )
    ).catch((err) => {
      console.error("Failed to move folder, reverting", err);
      onRefresh();
    });
  };

  const handleDragCancel = () => {
    if (hoverExpandTimerRef.current)
      clearTimeout(hoverExpandTimerRef.current);
    hoverExpandTimerRef.current = null;
    hoverExpandTargetRef.current = null;
    setActiveId(null);
    setDropTarget(null);
  };

  // ─── Folder CRUD ──────────────────────────────────────────

  const handleAddRootFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const rootFolders = folders.filter((f) => f.parent_id === null);
      const maxSortOrder = Math.max(
        0,
        ...rootFolders.map((f) => f.sort_order || 0)
      );
      await folderService.createFolder({
        name: newFolderName.trim(),
        parent_id: null,
        sort_order: maxSortOrder + 1,
      });
      setNewFolderName("");
      setIsAddingRoot(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to add folder", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await folderService.deleteFolder(id);
      if (activeFolderId === id) onFolderSelect(null);
      onRefresh();
    } catch (err) {
      console.error("Failed to delete folder", err);
    }
  };

  const activeFolder = folders.find((f) => f.id === activeId);

  return (
    <aside className="w-60 border-r border-slate-100 bg-white flex flex-col overflow-hidden select-none shrink-0">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* All Secrets */}
          <div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.25 text-[13px] font-medium transition-colors cursor-pointer",
                activeFolderId === null
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
              onClick={() => onFolderSelect(null)}
            >
              <Home className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span>All Secrets</span>
            </div>
          </div>

          {/* Folders */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400/80">
                Folders
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    onClick={() => setIsAddingRoot(!isAddingRoot)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>New folder</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {isAddingRoot && (
              <form onSubmit={handleAddRootFolder} className="px-1 mb-1">
                <Input
                  autoFocus
                  placeholder="Folder name..."
                  className="h-7 text-[12px] rounded-md border-slate-200"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onBlur={() => !newFolderName && setIsAddingRoot(false)}
                />
              </form>
            )}

            {/* DndContext — no SortableContext, no item shifting */}
            <DndContext
              sensors={sensors}
              collisionDetection={treeCollision}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {renderFolderTree(folders, null, expandedIds, {
                activeFolderId,
                onFolderSelect,
                onDelete: handleDelete,
                onRefresh,
                onToggleExpand: toggleExpand,
                dropTarget,
              })}

              <DragOverlay
                dropAnimation={{
                  sideEffects: defaultDropAnimationSideEffects({
                    styles: { active: { opacity: "0.4" } },
                  }),
                }}
              >
                {activeFolder ? (
                  <NavItem
                    folder={activeFolder}
                    activeFolderId={activeFolderId}
                    onFolderSelect={onFolderSelect}
                    allFolders={folders}
                    onDelete={handleDelete}
                    onRefresh={onRefresh}
                    expandedIds={expandedIds}
                    onToggleExpand={toggleExpand}
                    dropTarget={null}
                    isOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            {folders.filter((f) => f.parent_id === null).length === 0 &&
              !isAddingRoot && (
                <p className="px-2 py-6 text-[12px] text-slate-400 text-center">
                  No folders yet
                </p>
              )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
