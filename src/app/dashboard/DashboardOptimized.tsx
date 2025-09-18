'use client';

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, PlusCircle, Upload, Crown, MoreHorizontal, Sun, Moon, LogOut, UserCog, FileText, LayoutDashboard, Trash2 } from "lucide-react"
import { getHashColor, getUserColor, getStatusStyle, getStatusVariant } from "@/lib/theme-utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { PageLayout } from "@/components/PageLayout"
import { LoadingWithTips } from "@/components/LoadingWithTips"
import Link from "next/link"

// React Query hooks - instant updates!
import { useJobs, useCreateJob, useDeleteJob, useTransferOwnership } from "@/hooks/queries/useJobs"
import { useUsers } from "@/hooks/queries/useUsers"

export default function DashboardOptimized() {
  const { theme, setTheme } = useTheme();
  const { user, userProfile, isAuthenticated, isPendingApproval, hasAccess } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // React Query - with caching and optimistic updates
  const { data: jobs = [], isLoading: jobsLoading, error: jobsError } = useJobs();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const createJobMutation = useCreateJob();
  const deleteJobMutation = useDeleteJob();
  const transferOwnershipMutation = useTransferOwnership();

  // UI state
  const [createJobDialog, setCreateJobDialog] = useState(false);
  const [newJob, setNewJob] = useState({ venue: '', jobId: '' });
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [transferOwnershipDialog, setTransferOwnershipDialog] = useState(false);
  const [selectedJobForTransfer, setSelectedJobForTransfer] = useState<any>(null);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [deleteJobDialog, setDeleteJobDialog] = useState(false);
  const [selectedJobForDelete, setSelectedJobForDelete] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize owner and collaborator when dialog opens
  useEffect(() => {
    if (createJobDialog && userProfile) {
      setSelectedOwner(userProfile.id);
      setSelectedCollaborators([userProfile.id]);
    }
  }, [createJobDialog, userProfile]);

  const handleCreateJob = async () => {
    if (!userProfile || !newJob.venue || !newJob.jobId) {
      return;
    }

    const actualOwner = selectedOwner || userProfile.id;
    let finalCollaborators = [...new Set([...selectedCollaborators, actualOwner])];

    if (finalCollaborators.length === 0) {
      finalCollaborators = [userProfile.id];
    }

    const jobData = {
      venue: newJob.venue,
      job_id: newJob.jobId,
      collaborators: finalCollaborators,
      status: 'draft' as const
    };

    // Create job and navigate to it once created
    createJobMutation.mutate(jobData, {
      onSuccess: (createdJob) => {
        setCreateJobDialog(false);
        setNewJob({ venue: '', jobId: '' });
        setSelectedCollaborators([]);
        setSelectedOwner('');

        // Navigate to the newly created job with the real ID
        router.push(`/job?id=${createdJob.id}`);
      }
    });
  };

  const handleDeleteJob = async () => {
    if (!selectedJobForDelete) return;

    // Optimistic update - instant UI feedback!
    deleteJobMutation.mutate(selectedJobForDelete.id, {
      onSuccess: () => {
        setDeleteJobDialog(false);
        setSelectedJobForDelete(null);
      }
    });
  };

  const handleTransferOwnership = async () => {
    if (!selectedJobForTransfer || !newOwnerEmail) return;

    // Optimistic update
    transferOwnershipMutation.mutate({
      jobId: selectedJobForTransfer.id,
      newOwnerEmail
    }, {
      onSuccess: () => {
        setTransferOwnershipDialog(false);
        setSelectedJobForTransfer(null);
        setNewOwnerEmail('');
      }
    });
  };

  const handleOwnerClick = (user: any) => {
    const isSelected = selectedOwner === user.id;
    const newOwner = isSelected ? '' : user.id;
    setSelectedOwner(newOwner);

    if (newOwner && !selectedCollaborators.includes(user.id)) {
      setSelectedCollaborators(prev => [...prev, user.id]);
    }
  };

  const handleCollaboratorClick = (user: any) => {
    const isSelected = selectedCollaborators.includes(user.id);
    if (isSelected) {
      setSelectedCollaborators(prev => prev.filter(id => id !== user.id));
      if (selectedOwner === user.id) {
        setSelectedOwner('');
      }
    } else {
      setSelectedCollaborators(prev => [...prev, user.id]);
    }
  };

  const handleSignOut = async () => {
    try {
      router.push('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const getJobCreatorInfo = (job: any) => {
    if (job.creator) return job.creator;
    const creator = users.find(u => u.id === job.created_by);
    return creator || { initials: '??', color_index: 0 };
  };

  const getJobOwnerInfo = (job: any) => {
    if (job.owner) return job.owner;
    const owner = users.find(u => u.id === job.owner_id);
    return owner || { initials: '??', color_index: 0 };
  };

  // Show loading state with tips
  if (!mounted || jobsLoading || usersLoading) {
    return <LoadingWithTips />;
  }

  // Show error state
  if (jobsError) {
    return (
      <PageLayout title="Dashboard">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-destructive">Error loading dashboard</p>
            <Button
              onClick={() => window.location.reload()}
              className="mt-4"
            >
              Retry
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Dashboard">
      <ResizablePanelGroup direction="horizontal" className="h-screen w-full">
        <ResizablePanel defaultSize={75} minSize={50}>
          <div className="p-4 h-full">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h1 className="text-2xl font-semibold">Dashboard</h1>
                <p className="text-muted-foreground">
                  Manage your jobs and collaborate with your team
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setCreateJobDialog(true)}
                  disabled={createJobMutation.isPending}
                >
                  <PlusCircle className="w-4 h-4 mr-2" />
                  {createJobMutation.isPending ? 'Creating...' : 'New Job'}
                </Button>
              </div>
            </div>

            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue</TableHead>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Creator</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Collaborators</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        <div className="flex flex-col items-center gap-2">
                          <FileText className="w-8 h-8 text-muted-foreground" />
                          <p className="text-muted-foreground">No jobs found</p>
                          <Button
                            onClick={() => setCreateJobDialog(true)}
                            variant="outline"
                            size="sm"
                          >
                            Create your first job
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    jobs.map((job) => {
                      const creator = getJobCreatorInfo(job);
                      const owner = getJobOwnerInfo(job);

                      return (
                        <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell>
                            <Link
                              href={`/job?id=${job.id}`}
                              className="font-medium hover:underline"
                            >
                              {job.venue}
                            </Link>
                          </TableCell>
                          <TableCell>{job.job_id}</TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(job.status)}>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback
                                  className="text-xs"
                                  style={getUserColor(creator, theme, mounted)}
                                >
                                  {creator.initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{creator.email || 'Unknown'}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback
                                  className="text-xs"
                                  style={getUserColor(owner, theme, mounted)}
                                >
                                  {owner.initials}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{owner.email || 'Unknown'}</span>
                              <Crown className="w-3 h-3 text-yellow-500" />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {job.collaborator_users?.slice(0, 3).map((collaborator: any) => (
                                <Avatar key={collaborator.id} className="w-6 h-6">
                                  <AvatarFallback
                                    className="text-xs"
                                    style={getUserColor(collaborator, theme, mounted)}
                                  >
                                    {collaborator.initials}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {(job.collaborator_users?.length || 0) > 3 && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  +{(job.collaborator_users?.length || 0) - 3}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(job.last_activity).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => router.push(`/job?id=${job.id}`)}
                                >
                                  View Details
                                </DropdownMenuItem>
                                {(userProfile?.id === job.owner_id || userProfile?.role === 'admin') && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedJobForTransfer(job);
                                        setTransferOwnershipDialog(true);
                                      }}
                                    >
                                      Transfer Ownership
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => {
                                        setSelectedJobForDelete(job);
                                        setDeleteJobDialog(true);
                                      }}
                                      disabled={deleteJobMutation.isPending}
                                    >
                                      <Trash2 className="w-4 h-4 mr-2" />
                                      {deleteJobMutation.isPending ? 'Deleting...' : 'Delete Job'}
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </ResizablePanel>

      </ResizablePanelGroup>

      {/* Create Job Dialog */}
      <Dialog open={createJobDialog} onOpenChange={setCreateJobDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="venue">Venue *</Label>
                <Input
                  id="venue"
                  value={newJob.venue}
                  onChange={(e) => setNewJob(prev => ({ ...prev, venue: e.target.value }))}
                  placeholder="Enter venue name"
                />
              </div>
              <div>
                <Label htmlFor="jobId">Job ID *</Label>
                <Input
                  id="jobId"
                  value={newJob.jobId}
                  onChange={(e) => setNewJob(prev => ({ ...prev, jobId: e.target.value }))}
                  placeholder="Enter unique job ID"
                />
              </div>
            </div>

            <div>
              <Label>Select Owner</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                {users.filter(u => u.role !== 'pending').map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      selectedOwner === user.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleOwnerClick(user)}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarFallback
                        className="text-xs"
                        style={getUserColor(user, theme, mounted)}
                      >
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{user.full_name || user.email}</p>
                    </div>
                    {selectedOwner === user.id && (
                      <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label>Select Collaborators</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                {users.filter(u => u.role !== 'pending').map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                      selectedCollaborators.includes(user.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:bg-muted/50'
                    }`}
                    onClick={() => handleCollaboratorClick(user)}
                  >
                    <Avatar className="w-6 h-6">
                      <AvatarFallback
                        className="text-xs"
                        style={getUserColor(user, theme, mounted)}
                      >
                        {user.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{user.full_name || user.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateJobDialog(false)}
                disabled={createJobMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateJob}
                disabled={createJobMutation.isPending || !newJob.venue || !newJob.jobId}
              >
                {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog open={transferOwnershipDialog} onOpenChange={setTransferOwnershipDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Ownership</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Transfer ownership of "{selectedJobForTransfer?.venue}" to another user.
            </p>
            <div>
              <Label htmlFor="newOwnerEmail">New Owner Email</Label>
              <Input
                id="newOwnerEmail"
                value={newOwnerEmail}
                onChange={(e) => setNewOwnerEmail(e.target.value)}
                placeholder="Enter email address"
                type="email"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setTransferOwnershipDialog(false)}
                disabled={transferOwnershipMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleTransferOwnership}
                disabled={transferOwnershipMutation.isPending || !newOwnerEmail}
              >
                {transferOwnershipMutation.isPending ? 'Transferring...' : 'Transfer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Job Dialog */}
      <Dialog open={deleteJobDialog} onOpenChange={setDeleteJobDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{selectedJobForDelete?.venue}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteJobDialog(false)}
                disabled={deleteJobMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteJob}
                disabled={deleteJobMutation.isPending}
              >
                {deleteJobMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}