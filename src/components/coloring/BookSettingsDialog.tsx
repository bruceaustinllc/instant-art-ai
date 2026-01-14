import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ColoringBook } from '@/hooks/useColoringBooks';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  author_name: z.string().nullable().optional(),
  copyright_text: z.string().nullable().optional(),
});

type BookSettingsFormValues = z.infer<typeof formSchema>;

interface BookSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  book: ColoringBook;
  onSave: (bookId: string, updates: Partial<ColoringBook>) => Promise<any>;
}

const BookSettingsDialog = ({ open, onClose, book, onSave }: BookSettingsDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<BookSettingsFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: book.title,
      subtitle: book.subtitle || '',
      description: book.description || '',
      author_name: book.author_name || '',
      copyright_text: book.copyright_text || '',
    },
  });

  useEffect(() => {
    if (book) {
      form.reset({
        title: book.title,
        subtitle: book.subtitle || '',
        description: book.description || '',
        author_name: book.author_name || '',
        copyright_text: book.copyright_text || '',
      });
    }
  }, [book, form]);

  const handleSubmit = async (values: BookSettingsFormValues) => {
    setLoading(true);
    try {
      await onSave(book.id, values);
      toast({
        title: 'Book settings saved!',
        description: 'Your book details have been updated.',
      });
      onClose();
    } catch (error) {
      console.error('Failed to save book settings:', error);
      toast({
        title: 'Error saving settings',
        description: 'Something went wrong. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Book Settings</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Book Title</Label>
            <Input
              id="title"
              placeholder="e.g., Magical Creatures Coloring Book"
              {...form.register('title')}
              disabled={loading}
            />
            {form.formState.errors.title && (
              <p className="text-destructive text-sm">{form.formState.errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtitle">Subtitle (optional, for series)</Label>
            <Input
              id="subtitle"
              placeholder="e.g., Volume 1: Forest Friends"
              {...form.register('subtitle')}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="A brief description for your coloring book..."
              {...form.register('description')}
              rows={3}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="author_name">Author Name (optional)</Label>
            <Input
              id="author_name"
              placeholder="e.g., Jane Doe"
              {...form.register('author_name')}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="copyright_text">Copyright Text (optional)</Label>
            <Input
              id="copyright_text"
              placeholder="e.g., © 2023 Your Name"
              {...form.register('copyright_text')}
              disabled={loading}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !form.formState.isDirty}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default BookSettingsDialog;