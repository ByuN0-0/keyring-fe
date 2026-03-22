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
} from "@dnd-kit/core";
import { useState, useRef, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────

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

function parseGapId(id: string): {
  parentId: string | null;
  index: number;
} | null {
  if (!id.startsWith("gap::")) return null;
  const parts = id.split("::");
  const parentId = parts[1] === "root" ? null : parts[1];
  const index = parseInt(parts[2], 10);
  return { parentId, index };
}

function computeGapDrop(
  folders: Folder[],
  activeId: string,
  targetParentId: string | null,
  insertIndex: number
): {
  newFolders: Folder[];
  updates: { id: string; parent_id: string | null; sort_order: number }[];
} {
  const activeNode = folders.find((f) => f.id === activeId)!;

  // Get siblings of the target parent, excluding the dragged item
  const siblings = folders
    .filter((f) => f.parent_id === targetParentId && f.id !== activeId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // Adjust insertIndex: if active is being removed from BEFORE
  // the insertion point in the same parent, shift down by 1
  let adjustedIndex = insertIndex;
  if (activeNode.parent_id === targetParentId) {
    const allSiblings = folders
      .filter((f) => f.parent_id === targetParentId)
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const currentIndex = allSiblings.findIndex((f) => f.id === activeId);
    if (currentIndex !== -1 && currentIndex < insertIndex) {
      adjustedIndex = insertIndex - 1;
    }
  }

  // Insert active node at adjusted position
  const newSiblings = [
    ...siblings.slice(0, adjustedIndex),
    activeNode,
    ...siblings.slice(adjustedIndex),
  ];

  // Recompute sort_orders
  const updates = newSiblings.map((f, index) => ({
    id: f.id,
    parent_id: targetParentId,
    sort_order: index,
  }));

  // Check for no-op
  const activeUpdate = updates.find((u) => u.id === activeId);
  if (
    activeUpdate &&
    activeUpdate.parent_id === activeNode.parent_id &&
    activeUpdate.sort_order === activeNode.sort_order
  ) {
    // Check if all siblings also unchanged
    const allUnchanged = updates.every((u) => {
      const orig = folders.find((f) => f.id === u.id);
      return (
        orig &&
        orig.parent_id === u.parent_id &&
        orig.sort_order === u.sort_order
      );
    });
    if (allUnchanged) return { newFolders: folders, updates: [] };
  }

  const updateMap = new Map(updates.map((u) => [u.id, u]));
  const newFolders = folders.map((f) => {
    const update = updateMap.get(f.id);
    return update
      ? { ...f, parent_id: update.parent_id, sort_order: update.sort_order }
      : f;
  });

  return { newFolders, updates };
}

function computeNestDrop(
  folders: Folder[],
  activeId: string,
  targetFolderId: string
): {
  newFolders: Folder[];
  updates: { id: string; parent_id: string | null; sort_order: number }[];
} {
  const activeNode = folders.find((f) => f.id === activeId)!;

  // Children of the target folder (excluding active)
  const targetChildren = folders
    .filter((f) => f.parent_id === targetFolderId && f.id !== activeId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const newSortOrder = targetChildren.length; // append as last child

  const updates: { id: string; parent_id: string | null; sort_order: number }[] =
    [{ id: activeId, parent_id: targetFolderId, sort_order: newSortOrder }];

  // Re-number old siblings to close the gap
  const oldSiblings = folders
    .filter((f) => f.parent_id === activeNode.parent_id && f.id !== activeId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  oldSiblings.forEach((f, index) => {
    if (f.sort_order !== index) {
      updates.push({ id: f.id, parent_id: f.parent_id, sort_order: index });
    }
  });

  const updateMap = new Map(updates.map((u) => [u.id, u]));
  const newFolders = folders.map((f) => {
    const update = updateMap.get(f.id);
    return update
      ? { ...f, parent_id: update.parent_id, sort_order: update.sort_order }
      : f;
  });

  return { newFolders, updates };
}

// ─── TreeGap ──────────────────────────────────────────────────

function TreeGap({
  parentId,
  index,
  depth,
  isDragActive,
  draggedId,
  allFolders,
}: {
  parentId: string | null;
  index: number;
  depth: number;
  isDragActive: boolean;
  draggedId: string | null;
  allFolders: Folder[];
}) {
  // Disable if dropping into own descendants
  const isDisabled =
    !draggedId ||
    (parentId !== null && isDescendant(allFolders, draggedId, parentId)) ||
    parentId === draggedId;

  const gapId = `gap::${parentId ?? "root"}::${index}`;
  const { setNodeRef, isOver } = useDroppable({
    id: gapId,
    data: { type: "gap", parentId, index },
    disabled: isDisabled,
  });

  return (
    <div
      className="relative transition-[height] duration-150 ease-out overflow-hidden"
      style={{ height: isDragActive ? 8 : 0 }}
    >
      <div
        ref={setNodeRef}
        className="absolute top-0 bottom-0 right-0"
        style={{ left: `${8 + depth * 16}px` }}
      />
      {isOver && !isDisabled && (
        <div
          className="absolute top-1/2 right-2 h-[2px] -translate-y-1/2 rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)]"
          style={{ left: `${8 + depth * 16}px` }}
        />
      )}
    </div>
  );
}

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
  depth,
  isDragActive,
  draggedId,
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
  depth: number;
  isDragActive: boolean;
  draggedId: string | null;
  isOverlay?: boolean;
}) {
  const isExpanded = expandedIds.has(folder.id);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  // Disable droppable for self or own descendants
  const isDropDisabled =
    isOverlay ||
    !draggedId ||
    draggedId === folder.id ||
    isDescendant(allFolders, draggedId, folder.id);

  // useDraggable
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: folder.id,
    disabled: isOverlay,
  });

  // useDroppable — entire item = "inside/nest" target
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: folder.id,
    data: { type: "folder", folderId: folder.id },
    disabled: isDropDisabled,
  });

  // Combine refs
  const setNodeRef = useCallback(
    (el: HTMLElement | null) => {
      setDragRef(el);
      setDropRef(el);
    },
    [setDragRef, setDropRef]
  );

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
  const showNestHighlight = isOver && !isDropDisabled && isDragActive;

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
              showNestHighlight && "bg-indigo-50/70 ring-1 ring-indigo-300"
            )}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            onClick={handleSelect}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEditing();
            }}
          >
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

// ─── Build tree nodes (Gap + NavItem interleaved) ─────────────

function buildTreeNodes(
  folders: Folder[],
  parentId: string | null,
  expandedIds: Set<string>,
  depth: number,
  isDragActive: boolean,
  draggedId: string | null,
  props: {
    activeFolderId: string | null;
    onFolderSelect: (folderId: string | null) => void;
    onDelete: (id: string) => void;
    onRefresh: () => void;
    onToggleExpand: (id: string) => void;
  }
): React.ReactNode[] {
  const children = folders
    .filter((f) => f.parent_id === parentId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const nodes: React.ReactNode[] = [];

  // Gap before first child
  nodes.push(
    <TreeGap
      key={`gap-${parentId ?? "root"}-0`}
      parentId={parentId}
      index={0}
      depth={depth}
      isDragActive={isDragActive}
      draggedId={draggedId}
      allFolders={folders}
    />
  );

  for (let i = 0; i < children.length; i++) {
    const folder = children[i];

    // NavItem
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
        depth={depth}
        isDragActive={isDragActive}
        draggedId={draggedId}
      />
    );

    // Expanded children
    if (expandedIds.has(folder.id)) {
      nodes.push(
        ...buildTreeNodes(
          folders,
          folder.id,
          expandedIds,
          depth + 1,
          isDragActive,
          draggedId,
          props
        )
      );
    }

    // Gap after this child
    nodes.push(
      <TreeGap
        key={`gap-${parentId ?? "root"}-${i + 1}`}
        parentId={parentId}
        index={i + 1}
        depth={depth}
        isDragActive={isDragActive}
        draggedId={draggedId}
        allFolders={folders}
      />
    );
  }

  // If parent is expanded but has no children, emit one gap for dropping into
  if (children.length === 0 && parentId !== null) {
    // Gap already pushed above (the first gap) — that handles the empty case
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

  // Auto-expand timer
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const hoverExpandTargetRef = useRef<string | null>(null);

  const clearAutoExpandTimer = useCallback(() => {
    if (hoverExpandTimerRef.current) {
      clearTimeout(hoverExpandTimerRef.current);
      hoverExpandTimerRef.current = null;
    }
    hoverExpandTargetRef.current = null;
  }, []);

  const startAutoExpandTimer = useCallback(
    (folderId: string) => {
      if (hoverExpandTargetRef.current === folderId) return;
      clearAutoExpandTimer();
      hoverExpandTargetRef.current = folderId;
      hoverExpandTimerRef.current = setTimeout(() => {
        setExpandedIds((prev) => new Set([...prev, folderId]));
        hoverExpandTimerRef.current = null;
      }, 600);
    },
    [clearAutoExpandTimer]
  );

  useEffect(() => {
    return () => clearAutoExpandTimer();
  }, [clearAutoExpandTimer]);

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

    if (!over) {
      clearAutoExpandTimer();
      return;
    }

    const overData = over.data.current;

    // Auto-expand: only when hovering over a folder item (not a gap)
    if (overData?.type === "folder") {
      const folderId = overData.folderId as string;
      if (folderId !== (active.id as string)) {
        startAutoExpandTimer(folderId);
      } else {
        clearAutoExpandTimer();
      }
    } else {
      clearAutoExpandTimer();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    clearAutoExpandTimer();
    setActiveId(null);

    if (!over) return;

    const activeNodeId = active.id as string;
    const overData = over.data.current;

    if (!overData) return;

    if (overData.type === "gap") {
      // Gap drop: reorder/reposition
      const targetParentId = overData.parentId as string | null;
      const insertIndex = overData.index as number;

      // Validate: not dropping into own descendants
      if (
        targetParentId !== null &&
        isDescendant(folders, activeNodeId, targetParentId)
      ) {
        return;
      }
      if (targetParentId === activeNodeId) return;

      const { newFolders, updates } = computeGapDrop(
        folders,
        activeNodeId,
        targetParentId,
        insertIndex
      );

      if (updates.length === 0) return; // no-op

      onFoldersChange(newFolders);

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
    } else if (overData.type === "folder") {
      // Folder drop: nest inside
      const targetFolderId = overData.folderId as string;

      if (activeNodeId === targetFolderId) return;
      if (isDescendant(folders, activeNodeId, targetFolderId)) return;

      const { newFolders, updates } = computeNestDrop(
        folders,
        activeNodeId,
        targetFolderId
      );

      onFoldersChange(newFolders);
      setExpandedIds((prev) => new Set([...prev, targetFolderId]));

      Promise.all(
        updates.map((u) =>
          folderService.updateFolder(u.id, {
            parent_id: u.parent_id,
            sort_order: u.sort_order,
          })
        )
      ).catch((err) => {
        console.error("Failed to nest folder, reverting", err);
        onRefresh();
      });
    }
  };

  const handleDragCancel = () => {
    clearAutoExpandTimer();
    setActiveId(null);
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
  const isDragActive = activeId !== null;

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
          <div>
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

            <DndContext
              sensors={sensors}
              collisionDetection={pointerWithin}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {buildTreeNodes(
                folders,
                null,
                expandedIds,
                0,
                isDragActive,
                activeId,
                {
                  activeFolderId,
                  onFolderSelect,
                  onDelete: handleDelete,
                  onRefresh,
                  onToggleExpand: toggleExpand,
                }
              )}

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
                    depth={0}
                    isDragActive={false}
                    draggedId={null}
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
