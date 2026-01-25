import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Tables } from '@/integrations/supabase/types';
import { formatDistanceToNow } from 'date-fns';

type Job = Tables<'generation_jobs'>;

const JobsList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch jobs:', error);
      toast({
        title: 'Failed to load jobs',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setJobs(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('generation_jobs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'generation_jobs',
          filter: `user_id=eq.${user?.id}`,
        },
        () => {
          fetchJobs();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleDeleteJob = async (jobId: string) => {
    const { error } = await supabase
      .from('generation_jobs')
      .delete()
      .eq('id', jobId);

    if (error) {
      toast({
        title: 'Failed to delete job',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setJobs(prev => prev.filter(j => j.id !== jobId));
      toast({ title: 'Job deleted' });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'processing':
        return <Badge className="gap-1 bg-blue-500"><Loader2 className="h-3 w-3 animate-spin" /> Processing</Badge>;
      case 'completed':
        return <Badge className="gap-1 bg-green-500"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No background jobs</h3>
        <p className="text-muted-foreground">
          Queue pages using "Background" mode in batch generation to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Background Jobs</h2>
        <Button variant="outline" size="sm" onClick={fetchJobs}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => {
          const prompts = Array.isArray(job.prompts) ? job.prompts : [];
          const progress = job.total_count > 0 
            ? ((job.completed_count + job.failed_count) / job.total_count) * 100 
            : 0;

          return (
            <div
              key={job.id}
              className="glass-card rounded-lg p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(job.status)}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {prompts.length} prompt(s) • {job.model} • Border: {job.border}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteJob(job.id)}
                  className="shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {job.completed_count} completed
                    {job.failed_count > 0 && <span className="text-destructive"> • {job.failed_count} failed</span>}
                  </span>
                  <span>{job.total_count} total</span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>

              {job.error_message && (
                <p className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                  {job.error_message}
                </p>
              )}

              {/* Prompts preview */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View prompts
                </summary>
                <ul className="mt-2 space-y-1 pl-4 text-muted-foreground">
                  {prompts.slice(0, 5).map((p, i) => (
                    <li key={i} className="truncate">• {String(p)}</li>
                  ))}
                  {prompts.length > 5 && (
                    <li className="text-primary">...and {prompts.length - 5} more</li>
                  )}
                </ul>
              </details>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JobsList;