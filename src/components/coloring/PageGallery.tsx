import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, GripVertical, FileImage } from 'lucide-react';
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

interface PageGalleryProps {
  pages: BookPage[];
  onDeletePage: (pageId: string) => void;
  onReorderPages: (pages: BookPage[]) => void;
}

interface SortablePageProps {
  page: BookPage;
  onDelete: (pageId: string) => void;
}

const SortablePage = ({ page, onDelete }: SortablePageProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 'auto',
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={`glass-card overflow-hidden group relative ${isDragging ? 'shadow-2xl ring-2 ring-primary' : ''}`}
    >
      <div className="aspect-[8.5/11] relative bg-white">
        <img
          src={page.image_url}
          alt={page.prompt}
          className="w-full h-full object-contain"
        />
        
        {/* Page number badge */}
        <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
          Page {page.page_number}
        </div>

        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm p-1.5 rounded cursor-grab active:cursor-grabbing hover:bg-background transition-colors"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Overlay with actions */}
        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-none group-hover:pointer-events-auto">
          <Button
            variant="destructive"
            size="icon"
            onClick={() => onDelete(page.id)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="p-3">
        <p className="text-xs text-muted-foreground truncate" title={page.prompt}>
          {page.prompt}
        </p>
      </div>
    </Card>
  );
};

const PageGallery = ({ pages, onDeletePage, onReorderPages }: PageGalleryProps) => {
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
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Book Pages ({pages.length})
        </h3>
        <p className="text-sm text-muted-foreground">
          Drag pages to reorder
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={pages.map(p => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {pages.map((page) => (
              <SortablePage
                key={page.id}
                page={page}
                onDelete={onDeletePage}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default PageGallery;