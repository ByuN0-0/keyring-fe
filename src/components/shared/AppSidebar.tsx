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
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

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
  isOverlay = false,
}: {
  folder: Folder;
  activeFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
  allFolders: Folder[];
  onDelete: (id: string) => void;
  onRefresh: () => void;
  isOverlay?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: folder.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const children = allFolders
    .filter((f) => f.parent_id === folder.id)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSelect = () => {
    onFolderSelect(folder.id);
    setIsExpanded(true);
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
      setIsExpanded(true);
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
    <div ref={setNodeRef} style={style} className="space-y-0.5">
      <div
        className={cn(
          "group flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors cursor-pointer",
          activeFolderId === folder.id
            ? "bg-slate-100 text-slate-900 font-semibold"
            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900",
          isOverlay && "bg-white shadow-lg ring-1 ring-slate-200"
        )}
        onClick={handleSelect}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setIsEditing(true);
        }}
      >
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
              setIsExpanded(true);
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

      {(isExpanded || isAddingSub) && !isOverlay && (
        <div className="ml-3.5 border-l border-slate-100 pl-2 space-y-0.5">
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeNode = folders.find((f) => f.id === active.id);
    const overNode = folders.find((f) => f.id === over.id);

    if (!activeNode || !overNode) return;

    // Cases:
    // 1. Moving to a different parent (over is a folder, but not for sorting)
    //    Actually dnd-kit-sortable is mostly for sorting within same level.
    //    For nested DND, we need more complex logic.
    //    Simplified: If same level, reorder. If different level, change parent.

    if (active.id !== over.id) {
      if (activeNode.parent_id === overNode.parent_id) {
        // Reorder within same parent
        const sameLevelFolders = folders
          .filter((f) => f.parent_id === activeNode.parent_id)
          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const oldIndex = sameLevelFolders.findIndex((f) => f.id === active.id);
        const newIndex = sameLevelFolders.findIndex((f) => f.id === over.id);

        const newOrder = arrayMove(sameLevelFolders, oldIndex, newIndex);

        // Update all affected sort_orders
        try {
          await Promise.all(
            newOrder.map((f, index) =>
              folderService.updateFolder(f.id, { sort_order: index })
            )
          );
          onRefresh();
        } catch (err) {
          console.error("Failed to reorder folders", err);
        }
      } else {
        // Change parent
        try {
          // Check for circular reference
          let currentParent = overNode.parent_id;
          while (currentParent) {
            if (currentParent === activeNode.id) {
              console.error("Circular folder reference detected");
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
        } catch (err) {
          console.error("Failed to move folder", err);
        }
      }
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
