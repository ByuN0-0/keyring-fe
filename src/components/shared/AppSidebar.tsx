import { folderService } from "@/services/folderService";
import { Folder } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Folder as FolderIcon,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  LayoutDashboard,
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
import { useState } from "react";

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
    if (!isExpanded) onToggleExpand(folder.id);
  };

  const handleAddSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName) return;
    try {
      const parentChildren = allFolders.filter(
        (f) => f.parent_id === folder.id
      );
      const maxSortOrder = Math.max(
        0,
        ...parentChildren.map((f) => f.sort_order || 0)
      );

      await folderService.createFolder({
        name: newSubName,
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
    if (!editName || editName === folder.name) {
      setIsEditing(false);
      setEditName(folder.name);
      return;
    }
    try {
      await folderService.updateFolder(folder.id, {
        name: editName,
      });
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      console.error("Failed to rename folder", err);
      setEditName(folder.name);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="space-y-0.5 relative"
      data-folder-id={folder.id}
    >
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors cursor-pointer relative",
          activeFolderId === folder.id
            ? "bg-slate-100 text-slate-900 font-semibold"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
          isOverlay && "bg-white shadow-lg ring-1 ring-slate-200",
          dropPosition === "inside" && "bg-indigo-50 ring-2 ring-indigo-300"
        )}
        onClick={handleSelect}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
        {dropPosition === "before" && (
          <div className="absolute -top-px left-0 right-0 h-[2px] bg-indigo-500 z-10 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
        )}
        {dropPosition === "after" && (
          <div className="absolute -bottom-px left-0 right-0 h-[2px] bg-indigo-500 z-10 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
        )}
        <div
          {...attributes}
          {...listeners}
          className="p-1 -ml-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </div>

        <div className="flex items-center justify-center w-4 h-4">
          {children.length > 0 && (
            <button
              onClick={handleToggle}
              className="p-0.5 hover:bg-slate-200 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          {children.length === 0 && (
            <ChevronRight className="h-3 w-3 opacity-0" />
          )}
        </div>

        <FolderIcon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            activeFolderId === folder.id ? "text-indigo-500" : "text-slate-400"
          )}
        />

        {isEditing ? (
          <form
            onSubmit={handleRename}
            className="flex-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Input
              autoFocus
              className="h-6 py-0 px-1 text-[13px] rounded border-slate-200 focus:ring-1"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => setIsEditing(false)}
            />
          </form>
        ) : (
          <span className="flex-1 truncate text-[13px]">{folder.name}</span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsAddingSub(true);
              if (!isExpanded) onToggleExpand(folder.id);
            }}
            className="p-1 text-slate-300 hover:text-slate-600 hover:bg-slate-200 rounded transition-all"
          >
            <Plus className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("정말 삭제하시겠습니까?")) {
                onDelete(folder.id);
              }
            }}
            className="p-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {(isExpanded || isAddingSub) && (
        <div
          className={cn(
            "ml-3.5 border-l border-slate-100 pl-2 space-y-0.5",
            isOverlay && "border-slate-200"
          )}
        >
          {isAddingSub && (
            <form onSubmit={handleAddSub} className="px-2 mb-1 text-black">
              <Input
                autoFocus
                placeholder="New subfolder..."
                className="h-7 text-xs rounded-md border-slate-200 bg-white"
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
      activationConstraint: {
        distance: 8,
      },
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

    const overElement = document.querySelector(`[data-folder-id="${over.id}"]`);
    if (!overElement) {
      setDropTarget(null);
      return;
    }

    const rect = overElement.getBoundingClientRect();
    // Use delta from event to calculate current pointer position
    const pointerY =
      (event as unknown as { delta?: { y: number } }).delta?.y ?? 0;
    const initialY = (event.activatorEvent as MouseEvent | null)?.clientY ?? 0;
    const currentY = initialY + pointerY;

    const relativeY = currentY - rect.top;
    const height = rect.height;

    // Determine position: top 20% = before, middle 60% = inside, bottom 20% = after
    let position: DropPosition;
    if (relativeY < height * 0.2) {
      position = "before";
    } else if (relativeY > height * 0.8) {
      position = "after";
    } else {
      position = "inside";
    }

    setDropTarget({ id: over.id as string, position });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const currentDropTarget = dropTarget;
    setActiveId(null);
    setDropTarget(null);

    if (!over || !currentDropTarget) return;

    const activeNode = folders.find((f) => f.id === active.id);
    const overNode = folders.find((f) => f.id === currentDropTarget.id);

    if (!activeNode || !overNode || active.id === over.id) return;

    try {
      const position = currentDropTarget.position;

      if (position === "inside") {
        // Move as child of overNode
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
        onRefresh();
      } else {
        // Insert before or after overNode
        let targetParentId = overNode.parent_id;

        // Special case: dropping "after" the last visible child of an expanded folder
        // Check if overNode has a parent that is expanded and overNode is the last child
        if (position === "after" && overNode.parent_id) {
          const parentFolder = folders.find((f) => f.id === overNode.parent_id);
          if (parentFolder && expandedIds.has(parentFolder.id)) {
            const siblingChildren = folders
              .filter((f) => f.parent_id === parentFolder.id)
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

            const isLastChild =
              siblingChildren[siblingChildren.length - 1]?.id === overNode.id;

            if (isLastChild) {
              // If active is already in this parent's children, move to grandparent level
              if (activeNode.parent_id === parentFolder.id) {
                // Move to grandparent's level, after the parent
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
              // Otherwise, continue with normal logic but insert at parent's level after the parent
            }
          }
        }

        const siblings = folders
          .filter((f) => f.parent_id === targetParentId)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const overIndex = siblings.findIndex((f) => f.id === overNode.id);
        const insertIndex = position === "before" ? overIndex : overIndex + 1;

        // Remove active from siblings if it's in the same parent
        const filteredSiblings = siblings.filter((f) => f.id !== activeNode.id);

        // Adjust insert index if active was before overNode in same parent
        let adjustedInsertIndex = insertIndex;
        if (activeNode.parent_id === targetParentId) {
          const activeIndex = siblings.findIndex((f) => f.id === activeNode.id);
          if (activeIndex < overIndex) {
            adjustedInsertIndex = Math.max(0, insertIndex - 1);
          }
        }

        // Insert at the correct position
        const newSiblings = [
          ...filteredSiblings.slice(0, adjustedInsertIndex),
          activeNode,
          ...filteredSiblings.slice(adjustedInsertIndex),
        ];

        // Update all siblings with new sort orders
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
    if (!newFolderName) return;
    try {
      const maxSortOrder = Math.max(
        0,
        ...rootFolders.map((f) => f.sort_order || 0)
      );
      await folderService.createFolder({
        name: newFolderName,
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

  return (
    <aside className="w-72 border-r border-slate-100 bg-white flex flex-col overflow-hidden select-none">
      <div className="p-6 space-y-6 flex-1 overflow-y-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">
              Vault Workspace
            </h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg hover:bg-slate-100"
              onClick={() => setIsAddingRoot(!isAddingRoot)}
            >
              <Plus className="h-4 w-4 text-slate-400" />
            </Button>
          </div>

          <nav className="space-y-1">
            <div
              className={cn(
                "flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-bold transition-all cursor-pointer",
                activeFolderId === null
                  ? "text-indigo-600 bg-indigo-50 shadow-sm"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
              onClick={() => onFolderSelect(null)}
            >
              <LayoutDashboard className="h-4 w-4" />
              <span>Vault Root</span>
            </div>

            <div className="pt-4 space-y-1">
              {isAddingRoot && (
                <form onSubmit={handleAddRootFolder} className="px-2 mb-2">
                  <Input
                    autoFocus
                    placeholder="Folder name..."
                    className="h-8 text-xs rounded-lg border-slate-200"
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
                      styles: {
                        active: {
                          opacity: "0.5",
                        },
                      },
                    }),
                  }}
                >
                  {activeId ? (
                    <NavItem
                      folder={folders.find((f) => f.id === activeId)!}
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
                <p className="px-4 py-8 text-xs text-slate-400 text-center italic">
                  Create folders to start
                </p>
              )}
            </div>
          </nav>
        </div>
      </div>
    </aside>
  );
}
