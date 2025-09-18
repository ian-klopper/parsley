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
import { PlusCircle, Upload, Crown, MoreHorizontal, Trash2, FileText, Check } from "lucide-react"
import { UserNavigation } from "@/components/UserNavigation"
import { BackButton } from "@/components/BackButton"
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
import { LoadingWithTips } from "@/components/LoadingWithTips"
import { UserService } from "@/lib/user-service"
import Link from "next/link"

// React Query hooks - instant updates!
import { useJobs, useCreateJob, useDeleteJob, useTransferOwnership } from "@/hooks/queries/useJobs"
import { useUsers } from "@/hooks/queries/useUsers"

export default function Dashboard() {
  const { theme } = useTheme();
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
        setSelectedFile(null);

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
    if (selectedOwner === user.id) {
      // Can't unselect owner - must always have one
      return;
    }

    setSelectedOwner(user.id);

    // Owner must be a collaborator
    if (!selectedCollaborators.includes(user.id)) {
      setSelectedCollaborators(prev => [...prev, user.id]);
    }
  };

  const handleCollaboratorClick = (user: any) => {
    const isSelected = selectedCollaborators.includes(user.id);

    if (isSelected) {
      // Can't remove if they're the owner
      if (selectedOwner === user.id) {
        return;
      }
      setSelectedCollaborators(prev => prev.filter(id => id !== user.id));
    } else {
      setSelectedCollaborators(prev => [...prev, user.id]);
    }
  };


  const getJobCreatorInfo = (job: any) => {
    if (job.creator) return job.creator;
    const creator = users.find(u => u.id === job.created_by);
    return creator || { initials: '??', color_index: 0 };
  };


  // Show loading state with tips
  if (!mounted || jobsLoading || usersLoading) {
    return (
      <main className="h-screen bg-background flex items-center justify-center">
        <LoadingWithTips />
      </main>
    );
  }

  // Show error state
  if (jobsError) {
    return (
      <main className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-destructive">Error loading dashboard</p>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-screen bg-background">
      <ResizablePanelGroup direction="horizontal" className="h-full w-full">
        <ResizablePanel defaultSize={75} minSize={50}>
          <div className="p-4 h-full overflow-auto">
            <div className="mb-6">
              <div className="flex items-center gap-4">
                <BackButton />
                <h1 className="text-2xl font-semibold">Dashboard</h1>
              </div>
            </div>

            <div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Venue / Job ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Collaborators</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8">
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

                      return (
                        <TableRow key={job.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/job?id=${job.id}`)}>
                          <TableCell>
                              {job.venue}
                            <div className="text-xs text-muted-foreground">{job.job_id}</div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusVariant(job.status)}>
                              {job.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {job.collaborator_users?.map((collaborator: any) => {
                                const colorStyle = getUserColor(collaborator, theme, mounted);
                                const isOwner = collaborator.id === job.owner_id;
                                return (
                                  <Badge
                                    key={collaborator.id}
                                    variant="secondary"
                                    className="text-xs px-2 py-0.5 flex items-center gap-1"
                                    style={{
                                      backgroundColor: colorStyle.backgroundColor,
                                      color: colorStyle.color,
                                      border: 'none'
                                    }}
                                  >
                                    {collaborator.full_name || collaborator.email || 'Unknown'}
                                    {isOwner && <Crown className="w-3 h-3" style={{color: colorStyle.color}} />}
                                  </Badge>
                                );
                              })}
                              {(!job.collaborator_users || job.collaborator_users.length === 0) && (
                                <span className="text-xs text-muted-foreground">
                                  No collaborators
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(job.last_activity).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedJobForDelete(job);
                                setDeleteJobDialog(true);
                              }}
                              disabled={deleteJobMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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

        <ResizableHandle withHandle={false} />

        <ResizablePanel defaultSize={25} minSize={20}>
          <div className="p-4 border-l h-full flex flex-col">
            <div className="flex justify-end mb-4">
              <UserNavigation />
            </div>
            <Button
              onClick={() => setCreateJobDialog(true)}
              disabled={createJobMutation.isPending}
              className="mb-4 w-full"
            >
              <PlusCircle className="w-4 h-4 mr-2" />
              {createJobMutation.isPending ? 'Creating...' : 'New Job'}
            </Button>

            <ScrollArea className="flex-1">
              <div className="space-y-2">
                {users.filter(u => u.role === 'admin').map((admin) => (
                  <div key={admin.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback
                        style={getUserColor(admin, theme, mounted)}
                      >
                        {admin.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-medium truncate">{admin.full_name || admin.email}</p>
                        <Crown className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{admin.email}</p>
                    </div>
                  </div>
                ))}
                {users.filter(u => u.role === 'user').map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback
                        style={getUserColor(member, theme, mounted)}
                      >
                        {member.initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.full_name || member.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Create Job Dialog */}
      <Dialog open={createJobDialog} onOpenChange={setCreateJobDialog}>
        <DialogContent className="max-w-lg dark:bg-neutral-900">
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
              <Label>Upload Menu File (Optional)</Label>
              <div className="mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/50 transition-colors dark:bg-black">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedFile(file);
                    }
                  }}
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  {selectedFile ? (
                    <div>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground">PDF, PNG, JPG, Excel, CSV</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div>
              <Label>Team Members</Label>
              <p className="text-xs text-muted-foreground mb-2">Select collaborators and choose an owner (crown icon)</p>
              <div className="space-y-2 max-h-64 overflow-y-auto p-2 dark:bg-black rounded-lg">
                {users.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No team members available</p>
                ) : users.map((user) => {
                  console.log(user);
                  const isCollaborator = selectedCollaborators.includes(user.id);
                  const isOwner = selectedOwner === user.id;
                  return (
                    <div
                      key={user.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-muted/50"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarFallback
                          style={getUserColor(user, theme, mounted)}
                        >
                          {user.initials || UserService.generateInitials(user.full_name) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Switch
                        checked={isCollaborator}
                        onCheckedChange={() => handleCollaboratorClick(user)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={`w-8 h-8 p-0 ${
                          isOwner ? 'text-yellow-500 hover:text-yellow-500' : 'text-gray-400 hover:text-gray-600'
                        }`}
                        onClick={() => handleOwnerClick(user)}
                        title={!isCollaborator && !isOwner ? "Must be a collaborator to be owner" : "Set as owner"}
                      >
                        <Crown className={`h-4 w-4`} />
                      </Button>
                    </div>
                  );
                })}
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
        <DialogContent className="dark:bg-neutral-900">
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
        <DialogContent className="dark:bg-neutral-900">
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
    </main>
  );
}