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
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useState, useRef, useEffect } from "react";

type DropPosition = "before" | "after" | "inside" | null;

interface AppSidebarProps {
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  folders: Folder[];
  onRefresh: () => void;
}

function NavItem({
  folder,
  activeFolderId,
  onFolderSelect,
  allFolders,
  onDelete,
  onRefresh,
  expandedIds,
  onToggleExpand,
  activeId,
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
  activeId: string | null;
  dropTarget: { id: string; position: DropPosition } | null;
  isOverlay?: boolean;
}) {
  const isExpanded = expandedIds.has(folder.id);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: folder.id,
    disabled: isOverlay,
  });

  const style = {
    opacity: isDragging ? 0.4 : 1,
  };

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="space-y-0.5 relative"
      data-folder-id={folder.id}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              "group relative flex items-center gap-1 rounded-md px-2 py-1.25 text-[13px] transition-colors cursor-pointer",
              isActive
                ? "bg-slate-100 text-slate-900 font-medium"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              isOverlay &&
                "bg-white/95 shadow-[0_4px_16px_rgba(0,0,0,0.1)] ring-1 ring-slate-200/80",
              dropPosition === "inside" &&
                "bg-indigo-50/60 ring-1 ring-indigo-200"
            )}
            onClick={handleSelect}
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEditing();
            }}
          >
            {/* DND drop indicators */}
            {dropPosition === "before" && (
              <div className="drop-indicator -top-px animate-in fade-in duration-100" />
            )}
            {dropPosition === "after" && (
              <div className="drop-indicator -bottom-px animate-in fade-in duration-100" />
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

            {/* Expand chevron */}
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

            {/* Folder icon */}
            {isExpanded ? (
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

            {/* Name / Edit input */}
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

            {/* Hover action buttons */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startAddSub();
                }}
                className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-200/60 rounded transition-all"
                title="Add subfolder"
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
                title="Delete folder"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        </ContextMenuTrigger>

        {/* Right-click context menu */}
        <ContextMenuContent className="w-44">
          <ContextMenuItem
            className="cursor-pointer"
            onSelect={startEditing}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            className="cursor-pointer"
            onSelect={startAddSub}
          >
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

      {/* Children */}
      {(isExpanded || isAddingSub) && (
        <div className="ml-4 border-l border-slate-100 pl-1.5 space-y-0.5">
          {isAddingSub && (
            <form onSubmit={handleAddSub} className="px-1 mb-1">
              <Input
                autoFocus
                placeholder="Subfolder name..."
                className="h-6 text-[12px] rounded border-slate-200 bg-white"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onBlur={() => !newSubName && setIsAddingSub(false)}
              />
            </form>
          )}
          <SortableContext
            items={children.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {children.map((child) => (
              <NavItem
                key={child.id}
                folder={child}
                activeFolderId={activeFolderId}
                onFolderSelect={onFolderSelect}
                allFolders={allFolders}
                onDelete={onDelete}
                onRefresh={onRefresh}
                expandedIds={expandedIds}
                onToggleExpand={onToggleExpand}
                activeId={activeId}
                dropTarget={dropTarget}
                isOverlay={isOverlay}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

export function AppSidebar({
  activeFolderId,
  onFolderSelect,
  folders,
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

  // Auto-expand on hover during drag
  const hoverExpandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverExpandTarget, setHoverExpandTarget] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
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
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const rootFolders = folders
    .filter((f) => f.parent_id === null)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      setDropTarget(null);
      return;
    }

    // Use dnd-kit's built-in rect instead of DOM querySelector
    const overRect = over.rect;
    const activeTranslated = active.rect.current.translated;

    if (!overRect || !activeTranslated) {
      setDropTarget(null);
      return;
    }

    // Use center of dragged item as position proxy
    const dragCenterY = activeTranslated.top + activeTranslated.height / 2;
    const relativeY = dragCenterY - overRect.top;
    const height = overRect.height;

    // Tightened zones: 25% before / 50% inside / 25% after
    let position: DropPosition;
    if (relativeY < height * 0.25) {
      position = "before";
    } else if (relativeY > height * 0.75) {
      position = "after";
    } else {
      position = "inside";
    }

    // Auto-expand collapsed folders after 600ms hover
    if (position === "inside") {
      if (hoverExpandTarget !== over.id) {
        if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
        setHoverExpandTarget(over.id as string);
        hoverExpandTimerRef.current = setTimeout(() => {
          const targetId = over.id as string;
          const hasChildren = folders.some((f) => f.parent_id === targetId);
          if (hasChildren) {
            setExpandedIds((prev) => new Set([...prev, targetId]));
          }
          hoverExpandTimerRef.current = null;
          setHoverExpandTarget(null);
        }, 600);
      }
    } else {
      if (hoverExpandTimerRef.current) {
        clearTimeout(hoverExpandTimerRef.current);
        hoverExpandTimerRef.current = null;
      }
      setHoverExpandTarget(null);
    }

    setDropTarget({ id: over.id as string, position });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDropTarget = dropTarget;

    // Cleanup
    if (hoverExpandTimerRef.current) clearTimeout(hoverExpandTimerRef.current);
    hoverExpandTimerRef.current = null;
    setHoverExpandTarget(null);
    setActiveId(null);
    setDropTarget(null);

    if (!over || !currentDropTarget) return;

    const activeNode = folders.find((f) => f.id === active.id);
    const overNode = folders.find((f) => f.id === currentDropTarget.id);

    if (!activeNode || !overNode || active.id === over.id) return;

    try {
      const position = currentDropTarget.position;

      if (position === "inside") {
        // Check for circular reference
        let currentParent: string | null = overNode.id;
        while (currentParent) {
          if (currentParent === activeNode.id) {
            console.error("Cannot move folder into itself or its descendants");
            return;
          }
          const parent = folders.find((f) => f.id === currentParent);
          currentParent = parent?.parent_id || null;
        }

        const targetChildren = folders.filter(
          (f) => f.parent_id === overNode.id
        );
        const maxOrder = Math.max(
          0,
          ...targetChildren.map((f) => f.sort_order || 0)
        );

        await folderService.updateFolder(activeNode.id, {
          parent_id: overNode.id,
          sort_order: maxOrder + 1,
        });
        // Auto-expand the target folder to show the moved item
        setExpandedIds((prev) => new Set([...prev, overNode.id]));
        onRefresh();
      } else {
        // Insert before or after overNode
        let targetParentId = overNode.parent_id;

        if (position === "after" && overNode.parent_id) {
          const parentFolder = folders.find((f) => f.id === overNode.parent_id);
          if (parentFolder && expandedIds.has(parentFolder.id)) {
            const siblingChildren = folders
              .filter((f) => f.parent_id === parentFolder.id)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

            const isLastChild =
              siblingChildren[siblingChildren.length - 1]?.id === overNode.id;

            if (isLastChild) {
              if (activeNode.parent_id === parentFolder.id) {
                targetParentId = parentFolder.parent_id;
                const grandparentSiblings = folders
                  .filter((f) => f.parent_id === targetParentId)
                  .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

                const parentIndex = grandparentSiblings.findIndex(
                  (f) => f.id === parentFolder.id
                );
                const filteredSiblings = grandparentSiblings.filter(
                  (f) => f.id !== activeNode.id
                );
                const insertIndex = parentIndex + 1;

                const newSiblings = [
                  ...filteredSiblings.slice(0, insertIndex),
                  activeNode,
                  ...filteredSiblings.slice(insertIndex),
                ];

                await Promise.all(
                  newSiblings.map((f, index) =>
                    folderService.updateFolder(f.id, {
                      parent_id: targetParentId,
                      sort_order: index,
                    })
                  )
                );
                onRefresh();
                return;
              }
            }
          }
        }

        const siblings = folders
          .filter((f) => f.parent_id === targetParentId)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const overIndex = siblings.findIndex((f) => f.id === overNode.id);
        const insertIndex = position === "before" ? overIndex : overIndex + 1;

        const filteredSiblings = siblings.filter((f) => f.id !== activeNode.id);

        let adjustedInsertIndex = insertIndex;
        if (activeNode.parent_id === targetParentId) {
          const activeIndex = siblings.findIndex((f) => f.id === activeNode.id);
          if (activeIndex < overIndex) {
            adjustedInsertIndex = Math.max(0, insertIndex - 1);
          }
        }

        const newSiblings = [
          ...filteredSiblings.slice(0, adjustedInsertIndex),
          activeNode,
          ...filteredSiblings.slice(adjustedInsertIndex),
        ];

        await Promise.all(
          newSiblings.map((f, index) =>
            folderService.updateFolder(f.id, {
              parent_id: targetParentId,
              sort_order: index,
            })
          )
        );
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to move folder", err);
    }
  };

  const handleAddRootFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
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
          {/* All Secrets / Root */}
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

          {/* Folders section */}
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 pb-0.5">
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
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={rootFolders.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {rootFolders.map((folder) => (
                  <NavItem
                    key={folder.id}
                    folder={folder}
                    activeFolderId={activeFolderId}
                    onFolderSelect={onFolderSelect}
                    allFolders={folders}
                    onDelete={handleDelete}
                    onRefresh={onRefresh}
                    expandedIds={expandedIds}
                    onToggleExpand={toggleExpand}
                    activeId={activeId}
                    dropTarget={dropTarget}
                  />
                ))}
              </SortableContext>

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
                    activeId={activeId}
                    dropTarget={null}
                    isOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>

            {rootFolders.length === 0 && !isAddingRoot && (
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
