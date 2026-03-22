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
  Plus,
  Trash2,
  Home,
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
} from "@dnd-kit/core";
import { useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────

interface AppSidebarProps {
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  folders: Folder[];
  onFoldersChange: (folders: Folder[]) => void;
  onRefresh: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────

function computeGapDrop(
  folders: Folder[],
  activeId: string,
  insertIndex: number
): {
  newFolders: Folder[];
  updates: { id: string; parent_id: string | null; sort_order: number }[];
} {
  const activeNode = folders.find((f) => f.id === activeId)!;

  const siblings = folders
    .filter((f) => f.parent_id === null && f.id !== activeId)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  // Adjust index when moving within the same list
  let adjustedIndex = insertIndex;
  const allSorted = folders
    .filter((f) => f.parent_id === null)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const currentIndex = allSorted.findIndex((f) => f.id === activeId);
  if (currentIndex !== -1 && currentIndex < insertIndex) {
    adjustedIndex = insertIndex - 1;
  }

  const newSiblings = [
    ...siblings.slice(0, adjustedIndex),
    activeNode,
    ...siblings.slice(adjustedIndex),
  ];

  const updates = newSiblings.map((f, index) => ({
    id: f.id,
    parent_id: null as string | null,
    sort_order: index,
  }));

  // No-op check
  const allUnchanged = updates.every((u) => {
    const orig = folders.find((f) => f.id === u.id);
    return orig && orig.sort_order === u.sort_order;
  });
  if (allUnchanged) return { newFolders: folders, updates: [] };

  const updateMap = new Map(updates.map((u) => [u.id, u]));
  const newFolders = folders.map((f) => {
    const update = updateMap.get(f.id);
    return update ? { ...f, sort_order: update.sort_order } : f;
  });

  return { newFolders, updates };
}

// ─── TreeGap (zero-height overlay) ───────────────────────────

function TreeGap({
  index,
  draggedId,
}: {
  index: number;
  draggedId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `gap::${index}`,
    data: { type: "gap", index },
    disabled: !draggedId,
  });

  return (
    <div className="relative" style={{ height: 0 }}>
      <div
        ref={setNodeRef}
        className="absolute left-2.5 right-0 z-10"
        style={{ top: -4, height: 8 }}
      />
      {isOver && draggedId && (
        <div
          className="absolute left-2.5 right-2 h-[2px] rounded-full bg-indigo-500 shadow-[0_0_6px_rgba(99,102,241,0.5)] z-20 pointer-events-none"
          style={{ top: -1 }}
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
  onDelete,
  onRefresh,
  isOverlay = false,
}: {
  folder: Folder;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  isOverlay?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
  } = useDraggable({
    id: folder.id,
    disabled: isOverlay,
  });

  const handleSelect = () => {
    if (!isEditing) onFolderSelect(folder.id);
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

  const isActive = activeFolderId === folder.id;

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      data-folder-id={folder.id}
      {...attributes}
      {...listeners}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group relative flex items-center gap-2 rounded-md py-1.5 px-2.5 text-sm transition-colors cursor-pointer",
              isActive
                ? "bg-slate-100 text-slate-900 font-medium"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              isOverlay &&
                "bg-white/95 shadow-[0_4px_16px_rgba(0,0,0,0.12)] ring-1 ring-slate-200/80 rounded-md"
            )}
            onClick={handleSelect}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEditing();
            }}
          >
            {/* Icon */}
            <FolderIcon
              className={cn(
                "h-4 w-4 shrink-0",
                isActive ? "text-indigo-500" : "text-slate-400"
              )}
            />

            {/* Name */}
            {isEditing ? (
              <form
                onSubmit={handleRename}
                className="flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
              >
                <Input
                  autoFocus
                  className="h-6 py-0 px-1 text-sm rounded border-slate-200 focus:ring-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => {
                    setIsEditing(false);
                    setEditName(folder.name);
                  }}
                />
              </form>
            ) : (
              <span className="flex-1 truncate text-sm">{folder.name}</span>
            )}

            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("이 폴더를 삭제하시겠습니까?"))
                  onDelete(folder.id);
              }}
              className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100 shrink-0"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-48">
          <ContextMenuItem className="cursor-pointer" onSelect={startEditing}>
            Rename
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
    </div>
  );
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const overData = over.data.current;
    if (!overData || overData.type !== "gap") return;

    const activeNodeId = active.id as string;
    const insertIndex = overData.index as number;

    const { newFolders, updates } = computeGapDrop(
      folders,
      activeNodeId,
      insertIndex
    );

    if (updates.length === 0) return;

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
  };

  const handleDragCancel = () => {
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

  // Build flat folder list with gaps
  const sortedFolders = folders
    .filter((f) => f.parent_id === null)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const folderNodes: React.ReactNode[] = [];
  folderNodes.push(<TreeGap key="gap-0" index={0} draggedId={activeId} />);
  for (let i = 0; i < sortedFolders.length; i++) {
    const folder = sortedFolders[i];
    folderNodes.push(
      <NavItem
        key={folder.id}
        folder={folder}
        activeFolderId={activeFolderId}
        onFolderSelect={onFolderSelect}
        onDelete={handleDelete}
        onRefresh={onRefresh}
      />
    );
    folderNodes.push(
      <TreeGap key={`gap-${i + 1}`} index={i + 1} draggedId={activeId} />
    );
  }

  return (
    <aside className="w-64 border-r border-slate-100 bg-white flex flex-col overflow-hidden select-none shrink-0">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* All Secrets */}
          <div>
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors cursor-pointer",
                activeFolderId === null
                  ? "bg-slate-100 text-slate-900"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
              onClick={() => onFolderSelect(null)}
            >
              <Home className="h-4 w-4 shrink-0 text-slate-400" />
              <span>All Secrets</span>
            </div>
          </div>

          {/* Folders */}
          <div>
            <div className="flex items-center justify-between px-2.5 pb-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400/80">
                Folders
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                    onClick={() => setIsAddingRoot(!isAddingRoot)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <p>New folder</p>
                </TooltipContent>
              </Tooltip>
            </div>

            {isAddingRoot && (
              <form onSubmit={handleAddRootFolder} className="px-1.5 mb-1.5">
                <Input
                  autoFocus
                  placeholder="Folder name..."
                  className="h-8 text-[13px] rounded-md border-slate-200"
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
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {folderNodes}

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
                    onDelete={handleDelete}
                    onRefresh={onRefresh}
                    isOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            {sortedFolders.length === 0 && !isAddingRoot && (
              <p className="px-2.5 py-6 text-[13px] text-slate-400 text-center">
                No folders yet
              </p>
            )}
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
