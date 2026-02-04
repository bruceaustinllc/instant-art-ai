import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Star, 
  Check, 
  X, 
  AlertCircle,
  Image as ImageIcon,
  Trash2,
  Tag,
  Filter,
  // Download icon removed - not used currently
} from 'lucide-react';
import { toast } from 'sonner';

interface PageManagerRow {
  id: string;
  page_number: number;
  prompt: string;
  art_style: string;
  category: string | null;
  triage_status: string;
  rating: number | null;
  created_at: string;
  image_url: string;
}

interface PageManagerProps {
  bookId: string;
  bookTitle: string;
  onClose: () => void;
}

const CATEGORIES = ['Animals', 'Nature', 'Vehicles', 'People', 'Fantasy', 'Food', 'Buildings', 'Abstract', 'Kids', 'Holidays'];
const TRIAGE_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: AlertCircle, color: 'bg-yellow-500' },
  { value: 'keep', label: 'Keep', icon: Check, color: 'bg-green-500' },
  { value: 'reject', label: 'Reject', icon: X, color: 'bg-red-500' },
  { value: 'needs_fix', label: 'Needs Fix', icon: AlertCircle, color: 'bg-orange-500' },
];

const PAGE_SIZE = 50;

const PageManager = ({ bookId, bookTitle, onClose }: PageManagerProps) => {
  const [rows, setRows] = useState<PageManagerRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterTriage, setFilterTriage] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [previewPage, setPreviewPage] = useState<PageManagerRow | null>(null);
  // thumbnailIndex removed - cycling not needed with single images

  // Fetch pages with lightweight query (no image_url initially for speed)
  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      // Build query
      let countQuery = supabase
        .from('book_pages')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', bookId);
      
      let dataQuery = supabase
        .from('book_pages')
        .select('id, page_number, prompt, art_style, category, triage_status, rating, created_at, image_url')
        .eq('book_id', bookId)
        .order('page_number', { ascending: true });

      // Apply filters
      if (filterCategory !== 'all') {
        countQuery = countQuery.eq('category', filterCategory);
        dataQuery = dataQuery.eq('category', filterCategory);
      }
      if (filterTriage !== 'all') {
        countQuery = countQuery.eq('triage_status', filterTriage);
        dataQuery = dataQuery.eq('triage_status', filterTriage);
      }
      if (searchQuery.trim()) {
        const search = `%${searchQuery.trim()}%`;
        countQuery = countQuery.ilike('prompt', search);
        dataQuery = dataQuery.ilike('prompt', search);
      }

      // Get count
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;
      setTotalCount(count || 0);

      // Get page data
      const offset = (currentPage - 1) * PAGE_SIZE;
      dataQuery = dataQuery.range(offset, offset + PAGE_SIZE - 1);

      const { data, error } = await dataQuery;
      if (error) throw error;

      setRows((data || []) as PageManagerRow[]);
    } catch (err) {
      console.error('Error fetching pages:', err);
      toast.error('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [bookId, currentPage, filterCategory, filterTriage, searchQuery]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory, filterTriage, searchQuery]);

  // Thumbnail cycling removed - using static thumbnails for performance

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Bulk actions
  const handleSelectAll = () => {
    if (selectedIds.size === rows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map(r => r.id)));
    }
  };

  const handleBulkCategory = async (category: string) => {
    if (selectedIds.size === 0) return;
    try {
      const { error } = await supabase
        .from('book_pages')
        .update({ category: category === 'none' ? null : category })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      toast.success(`Updated ${selectedIds.size} pages`);
      fetchPages();
      setSelectedIds(new Set());
    } catch (err) {
      toast.error('Failed to update category');
    }
  };

  const handleBulkTriage = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      const { error } = await supabase
        .from('book_pages')
        .update({ triage_status: status })
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      toast.success(`Updated ${selectedIds.size} pages`);
      fetchPages();
      setSelectedIds(new Set());
    } catch (err) {
      toast.error('Failed to update status');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} pages? This cannot be undone.`)) return;
    try {
      const { error } = await supabase
        .from('book_pages')
        .delete()
        .in('id', Array.from(selectedIds));
      if (error) throw error;
      toast.success(`Deleted ${selectedIds.size} pages`);
      fetchPages();
      setSelectedIds(new Set());
    } catch (err) {
      toast.error('Failed to delete pages');
    }
  };

  const handleSingleTriage = async (pageId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('book_pages')
        .update({ triage_status: status })
        .eq('id', pageId);
      if (error) throw error;
      setRows(prev => prev.map(r => r.id === pageId ? { ...r, triage_status: status } : r));
    } catch (err) {
      toast.error('Failed to update');
    }
  };

  const handleSingleRating = async (pageId: string, rating: number) => {
    try {
      const { error } = await supabase
        .from('book_pages')
        .update({ rating })
        .eq('id', pageId);
      if (error) throw error;
      setRows(prev => prev.map(r => r.id === pageId ? { ...r, rating } : r));
    } catch (err) {
      toast.error('Failed to update rating');
    }
  };

  const handleSingleCategory = async (pageId: string, category: string) => {
    try {
      const { error } = await supabase
        .from('book_pages')
        .update({ category: category === 'none' ? null : category })
        .eq('id', pageId);
      if (error) throw error;
      setRows(prev => prev.map(r => r.id === pageId ? { ...r, category: category === 'none' ? null : category } : r));
    } catch (err) {
      toast.error('Failed to update category');
    }
  };

  const getTriageColor = (status: string) => {
    const option = TRIAGE_OPTIONS.find(o => o.value === status);
    return option?.color || 'bg-muted';
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h2 className="text-lg font-semibold">{bookTitle} - Page Manager</h2>
          <Badge variant="secondary">{totalCount} pages</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-48"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="none">Uncategorized</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterTriage} onValueChange={setFilterTriage}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {TRIAGE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="border-b p-3 bg-muted/50 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <Select onValueChange={handleBulkCategory}>
            <SelectTrigger className="w-36">
              <Tag className="h-4 w-4 mr-1" />
              <span>Set Category</span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Clear Category</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={handleBulkTriage}>
            <SelectTrigger className="w-32">
              <span>Set Status</span>
            </SelectTrigger>
            <SelectContent>
              {TRIAGE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear Selection
          </Button>
        </div>
      )}

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No pages found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b text-left text-sm text-muted-foreground">
                  <th className="pb-2 pr-2 w-10">
                    <Checkbox 
                      checked={selectedIds.size === rows.length && rows.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="pb-2 pr-2 w-16">Thumb</th>
                  <th className="pb-2 pr-2 w-12">#</th>
                  <th className="pb-2 pr-2">Prompt</th>
                  <th className="pb-2 pr-2 w-28">Category</th>
                  <th className="pb-2 pr-2 w-28">Status</th>
                  <th className="pb-2 pr-2 w-28">Rating</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr 
                    key={row.id} 
                    className="border-b hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-2 pr-2">
                      <Checkbox 
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={(checked) => {
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            if (checked) next.add(row.id);
                            else next.delete(row.id);
                            return next;
                          });
                        }}
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <button 
                        onClick={() => setPreviewPage(row)}
                        className="w-12 h-12 rounded border bg-muted overflow-hidden hover:ring-2 ring-primary transition-all"
                      >
                        {row.image_url ? (
                          <img 
                            src={row.image_url} 
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <ImageIcon className="w-6 h-6 m-auto text-muted-foreground" />
                        )}
                      </button>
                    </td>
                    <td className="py-2 pr-2 text-sm font-mono">{row.page_number}</td>
                    <td className="py-2 pr-2">
                      <button 
                        onClick={() => setPreviewPage(row)}
                        className="text-left text-sm line-clamp-2 hover:text-primary transition-colors"
                      >
                        {row.prompt}
                      </button>
                    </td>
                    <td className="py-2 pr-2">
                      <Select 
                        value={row.category || 'none'} 
                        onValueChange={(v) => handleSingleCategory(row.id, v)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex gap-1">
                        {TRIAGE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => handleSingleTriage(row.id, opt.value)}
                            className={`w-7 h-7 rounded flex items-center justify-center transition-all ${
                              row.triage_status === opt.value 
                                ? `${opt.color} text-white` 
                                : 'bg-muted hover:bg-muted-foreground/20'
                            }`}
                            title={opt.label}
                          >
                            <opt.icon className="h-4 w-4" />
                          </button>
                        ))}
                      </div>
                    </td>
                    <td className="py-2 pr-2">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            onClick={() => handleSingleRating(row.id, star)}
                            className="p-0.5 hover:scale-110 transition-transform"
                          >
                            <Star 
                              className={`h-4 w-4 ${
                                row.rating && star <= row.rating 
                                  ? 'fill-yellow-400 text-yellow-400' 
                                  : 'text-muted-foreground'
                              }`} 
                            />
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ScrollArea>

      {/* Pagination */}
      <div className="border-t p-3 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <span className="text-sm px-2">
            Page {currentPage} of {totalPages || 1}
          </span>
          <Button 
            variant="outline" 
            size="sm"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewPage} onOpenChange={() => setPreviewPage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Page #{previewPage?.page_number}</DialogTitle>
          </DialogHeader>
          {previewPage && (
            <div className="space-y-4">
              <div className="bg-muted rounded-lg p-2 flex items-center justify-center">
                <img 
                  src={previewPage.image_url} 
                  alt={previewPage.prompt}
                  className="max-h-[60vh] object-contain"
                />
              </div>
              <div className="text-sm">
                <p className="font-medium mb-1">Prompt:</p>
                <p className="text-muted-foreground">{previewPage.prompt}</p>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Style: </span>
                  <Badge variant="secondary">{previewPage.art_style}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Category: </span>
                  <Badge variant="outline">{previewPage.category || 'None'}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge className={getTriageColor(previewPage.triage_status)}>
                    {TRIAGE_OPTIONS.find(o => o.value === previewPage.triage_status)?.label}
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PageManager;
