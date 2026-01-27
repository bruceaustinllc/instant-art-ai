import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, GripVertical, FileImage, CheckSquare, X } from 'lucide-react';
import { BookPage } from '@/hooks/useColoringBooks';
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
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PageGalleryProps {
  pages: BookPage[];
  onDeletePage: (pageId: string) => void;
  onReorderPages: (pages: BookPage[]) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
}

interface SortablePageProps {
  page: BookPage;
  onDelete: (pageId: string) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (pageId: string) => void;
}

interface PageCardProps {
  page: BookPage;
  onDelete: (pageId: string) => void;
  selectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (pageId: string) => void;
}

const SortablePage = ({ page, onDelete, selectionMode, isSelected, onToggleSelect }: SortablePageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id, disabled: selectionMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect(page.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`rounded-lg border bg-card text-card-foreground shadow-sm glass-card overflow-hidden group relative ${isDragging ? 'shadow-2xl ring-2 ring-primary' : ''} ${selectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="aspect-[8.5/11] relative bg-background">
        <img
          src={page.image_url}
          alt={page.prompt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain"
        />
        
        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(page.id)}
              className="h-6 w-6 bg-background border-2"
            />
          </div>
        )}

        {/* Page number badge */}
        {!selectionMode && (
          <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
            Page {page.page_number}
          </div>
        )}

        {/* Drag handle */}
        {!selectionMode && (
          <div
            {...attributes}
            {...listeners}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-background transition-colors"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        )}

        {/* Overlay with actions (only in normal mode) */}
        {!selectionMode && (
          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onDelete(page.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Selection overlay */}
        {selectionMode && isSelected && (
          <div className="absolute inset-0 bg-primary/20 pointer-events-none" />
        )}
      </div>

      <div className="p-3">
        <p className="text-xs text-muted-foreground truncate" title={page.prompt}>
          {page.prompt}
        </p>
      </div>
    </div>
  );
};

const PageCard = ({ page, onDelete, selectionMode, isSelected, onToggleSelect }: PageCardProps) => {
  const handleClick = () => {
    if (selectionMode) {
      onToggleSelect(page.id);
    }
  };

  return (
    <div 
      onClick={handleClick}
      className={`rounded-lg border bg-card text-card-foreground shadow-sm glass-card overflow-hidden group relative ${selectionMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}
    >
      <div className="aspect-[8.5/11] relative bg-background">
        <img
          src={page.image_url}
          alt={page.prompt}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-contain"
        />

        {/* Selection checkbox */}
        {selectionMode && (
          <div className="absolute top-2 left-2 z-10">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(page.id)}
              className="h-6 w-6 bg-background border-2"
            />
          </div>
        )}

        {/* Page number badge */}
        {!selectionMode && (
          <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
            Page {page.page_number}
          </div>
        )}

        {/* Overlay with actions (only in normal mode) */}
        {!selectionMode && (
          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
            <Button
              variant="destructive"
              size="icon"
              onClick={() => onDelete(page.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Selection overlay */}
        {selectionMode && isSelected && (
          <div className="absolute inset-0 bg-primary/20 pointer-events-none" />
        )}
      </div>

      <div className="p-3">
        <p className="text-xs text-muted-foreground truncate" title={page.prompt}>
          {page.prompt}
        </p>
      </div>
    </div>
  );
};

const PageGallery = ({ pages, onDeletePage, onReorderPages, hasMore, loadingMore, onLoadMore }: PageGalleryProps) => {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const canReorder = !hasMore && !selectionMode;
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = pages.findIndex((p) => p.id === active.id);
      const newIndex = pages.findIndex((p) => p.id === over.id);
      
      const reorderedPages = arrayMove(pages, oldIndex, newIndex).map((page, index) => ({
        ...page,
        page_number: index + 1,
      }));
      
      onReorderPages(reorderedPages);
    }
  };

  const toggleSelect = (pageId: string) => {
    setSelectedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedPages(new Set(pages.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedPages(new Set());
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedPages(new Set());
  };

  const handleDeleteSelected = () => {
    selectedPages.forEach(pageId => {
      onDeletePage(pageId);
    });
    setShowDeleteConfirm(false);
    exitSelectionMode();
  };

  if (pages.length === 0) {
    return (
      <Card className="glass-card p-12 text-center">
        <FileImage className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          No pages yet
        </h3>
        <p className="text-muted-foreground">
          Generate your first coloring page using the form above
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with selection controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {selectionMode ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectedPages.size} selected
              </span>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                Select All
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={selectedPages.size === 0}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete ({selectedPages.size})
              </Button>
              <Button variant="outline" size="sm" onClick={exitSelectionMode}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {canReorder ? 'Drag pages to reorder' : hasMore ? 'Load all pages to reorder' : ''}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectionMode(true)}
            >
              <CheckSquare className="h-4 w-4 mr-1" />
              Select
            </Button>
          </>
        )}
      </div>

      <div className="space-y-6">
        {canReorder && !selectionMode ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {pages.map((page) => (
                  <SortablePage
                    key={page.id}
                    page={page}
                    onDelete={onDeletePage}
                    selectionMode={selectionMode}
                    isSelected={selectedPages.has(page.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {pages.map((page) => (
              <PageCard
                key={page.id}
                page={page}
                onDelete={onDeletePage}
                selectionMode={selectionMode}
                isSelected={selectedPages.has(page.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )}

        {hasMore && onLoadMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={onLoadMore}
              disabled={!!loadingMore}
            >
              {loadingMore ? 'Loading…' : 'Load more pages'}
            </Button>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedPages.size} pages?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. These pages will be permanently deleted from your book.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PageGallery;
