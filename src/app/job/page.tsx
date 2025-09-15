'use client';

import { Suspense } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Users, Crown, Upload, Play, Trash2 } from "lucide-react"
import { UserNavigation } from "@/components/UserNavigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { getHashColor, getUserColor, getStatusStyle, getStatusVariant } from "@/lib/theme-utils"
import { useAuth } from "@/contexts/AuthContext"
import { BackButton } from "@/components/BackButton"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useSearchParams, useRouter } from "next/navigation"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { LoadingWithTips } from "@/components/LoadingWithTips";
import { jobTips } from "@/lib/loading-tips";

// React Query hooks - instant updates!
import { useJob, useUpdateJob, useDeleteJob, useTransferOwnership } from "@/hooks/queries/useJobs"
import { useUsers } from "@/hooks/queries/useUsers"

const ItemTable = dynamic(() => import("@/components/ItemTable").then(mod => ({ default: mod.ItemTable })), {
  loading: () => <div className="animate-pulse h-32 bg-muted rounded">Loading table...</div>
});

import { allItems, FoodItem } from "@/lib/food-data";
import { tabCategories } from "@/lib/menu-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function JobPageContent() {
  const { user, userProfile, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('id');

  // React Query hooks with caching and optimistic updates
  const { data: job, isLoading: jobLoading, error: jobError } = useJob(jobId || '');
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const updateJobMutation = useUpdateJob();
  const deleteJobMutation = useDeleteJob();
  const transferOwnershipMutation = useTransferOwnership();

  const [mounted, setMounted] = useState(false);
  const [collaboratorsDialog, setCollaboratorsDialog] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [items, setItems] = useState<FoodItem[]>(allItems);
  const [extractionStarted, setExtractionStarted] = useState(false);
  const [transferOwnershipDialog, setTransferOwnershipDialog] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(false);

  const tabs = [
    "Food",
    "Cocktails + Shots",
    "Beer + RTDs",
    "Wine",
    "Liquor",
    "N/A + Mocktails",
    "Merchandise",
    "Menu Structure",
    "Modifiers",
  ];

  const getItemsForTab = useCallback((tab: string) => {
    const categories = tabCategories[tab];
    if (!categories) return [];
    return items.filter(item => categories.includes(item.subcategory));
  }, [items]);

  const handleItemsChange = useCallback((updatedItems: FoodItem[], tab: string) => {
    const categories = tabCategories[tab];
    if (!categories) return;

    const filteredUpdatedItems = updatedItems.filter(item => categories.includes(item.subcategory));
    setItems(prevItems => {
      const nonTabItems = prevItems.filter(item => !categories.includes(item.subcategory));
      return [...nonTabItems, ...filteredUpdatedItems];
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize selected collaborators when job loads
  useEffect(() => {
    if (job && job.collaborator_users) {
      setSelectedCollaborators(job.collaborator_users.map((c: any) => c.id));
    }
  }, [job]);

  if (!mounted || jobLoading || usersLoading) {
    return <LoadingWithTips tips={jobTips} />;
  }

  if (jobError || !job) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-destructive">Error loading job</p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="mt-4"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!jobId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">No job ID provided</p>
          <Button
            onClick={() => router.push('/dashboard')}
            className="mt-4"
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const canEdit = userProfile && (
    userProfile.id === job.created_by ||
    userProfile.id === job.owner_id ||
    userProfile.role === 'admin'
  );

  const handleUpdateCollaborators = () => {
    if (!canEdit) return;

    // Optimistic update - instant UI feedback!
    updateJobMutation.mutate({
      id: job.id,
      data: { collaborators: selectedCollaborators }
    }, {
      onSuccess: () => {
        setCollaboratorsDialog(false);
      }
    });
  };

  const handleStatusChange = (newStatus: string) => {
    if (!canEdit) return;

    // Optimistic update - instant UI response!
    updateJobMutation.mutate({
      id: job.id,
      data: { status: newStatus as any }
    });
  };

  const handleDeleteJob = () => {
    // Optimistic update
    deleteJobMutation.mutate(job.id, {
      onSuccess: () => {
        router.push('/dashboard');
      }
    });
  };

  const handleTransferOwnership = () => {
    transferOwnershipMutation.mutate({
      jobId: job.id,
      newOwnerEmail
    }, {
      onSuccess: () => {
        setTransferOwnershipDialog(false);
        setNewOwnerEmail('');
      }
    });
  };


  const handleCollaboratorClick = (userId: string) => {
    if (!canEdit) return;

    const isSelected = selectedCollaborators.includes(userId);
    if (isSelected) {
      setSelectedCollaborators(prev => prev.filter(id => id !== userId));
    } else {
      setSelectedCollaborators(prev => [...prev, userId]);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton />
            <div>
              <h1 className="text-2xl font-semibold">{job.venue}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={getStatusVariant(job.status)}>
                  {job.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Job ID: {job.job_id}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Change Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange('draft')}
                    disabled={updateJobMutation.isPending}
                  >
                    Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange('live')}
                    disabled={updateJobMutation.isPending}
                  >
                    Live
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange('processing')}
                    disabled={updateJobMutation.isPending}
                  >
                    Processing
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleStatusChange('complete')}
                    disabled={updateJobMutation.isPending}
                  >
                    Complete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={75} minSize={50}>
            <div className="p-4 h-full overflow-auto">
              <Tabs defaultValue="Food" className="h-full flex flex-col">
                <TabsList className="grid w-full grid-cols-9 mb-4">
                  {tabs.map((tab) => (
                    <TabsTrigger key={tab} value={tab} className="text-xs">
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {tabs.map((tab) => (
                  <TabsContent key={tab} value={tab} className="flex-1 overflow-hidden">
                    <ItemTable
                      items={getItemsForTab(tab)}
                      tab={tab}
                      onItemsChange={handleItemsChange}
                      readonly={!canEdit}
                    />
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle={false} />

          <ResizablePanel defaultSize={25} minSize={20}>
            <div className="p-4 border-l h-full overflow-auto flex flex-col">
              <div className="flex justify-end mb-4">
                <UserNavigation />
              </div>
              <div className="space-y-6 flex-1">
                {/* Job Info */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Job Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span>{new Date(job.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Updated:</span>
                      <span>{new Date(job.updated_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Activity:</span>
                      <span>{new Date(job.last_activity).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Creator */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Creator</h3>
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback
                        style={{ backgroundColor: getUserColor(job.creator?.color_index || 0) }}
                      >
                        {job.creator?.initials || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {job.creator?.full_name || job.creator?.email || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {job.creator?.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Owner */}
                <div>
                  <h3 className="text-sm font-medium mb-2">Owner</h3>
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback
                        style={{ backgroundColor: getUserColor(job.owner?.color_index || 0) }}
                      >
                        {job.owner?.initials || '??'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {job.owner?.full_name || job.owner?.email || 'Unknown'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {job.owner?.email}
                      </p>
                    </div>
                    <Crown className="w-4 h-4 text-yellow-500" />
                  </div>
                  {canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => setTransferOwnershipDialog(true)}
                      disabled={transferOwnershipMutation.isPending}
                    >
                      {transferOwnershipMutation.isPending ? 'Transferring...' : 'Transfer Ownership'}
                    </Button>
                  )}
                </div>

                {/* Team Members */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium">Team Members</h3>
                    {canEdit && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCollaboratorsDialog(true)}
                        disabled={updateJobMutation.isPending}
                      >
                        <Users className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {job.collaborator_users?.map((collaborator: any) => (
                      <div key={collaborator.id} className="flex items-center gap-2">
                        <Avatar className="w-6 h-6">
                          <AvatarFallback
                            className="text-xs"
                            style={{ backgroundColor: getUserColor(collaborator.color_index || 0) }}
                          >
                            {collaborator.initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">
                            {collaborator.full_name || collaborator.email}
                          </p>
                        </div>
                        {collaborator.id === job.owner_id && (
                          <Crown className="w-3 h-3 text-yellow-500" />
                        )}
                      </div>
                    )) || (
                      <p className="text-xs text-muted-foreground">No collaborators</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {canEdit && (
                  <div className="pt-4 border-t">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => setDeleteDialog(true)}
                      disabled={deleteJobMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      {deleteJobMutation.isPending ? 'Deleting...' : 'Delete Job'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Collaborators Dialog */}
      <Dialog open={collaboratorsDialog} onOpenChange={setCollaboratorsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Team Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {users.filter(u => u.role !== 'pending').map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                    selectedCollaborators.includes(user.id)
                      ? 'bg-primary/10 border border-primary'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                  onClick={() => handleCollaboratorClick(user.id)}
                >
                  <Avatar className="w-8 h-8">
                    <AvatarFallback
                      style={{ backgroundColor: getUserColor(user.color_index || 0) }}
                    >
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.full_name || user.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                  {user.id === job.owner_id && (
                    <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCollaboratorsDialog(false)}
                disabled={updateJobMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdateCollaborators}
                disabled={updateJobMutation.isPending}
              >
                {updateJobMutation.isPending ? 'Updating...' : 'Update'}
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
              Transfer ownership of this job to another user.
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
      <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this job? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setDeleteDialog(false)}
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
    </div>
  );
}

export default function JobPage() {
  return (
    <Suspense fallback={<LoadingWithTips tips={jobTips} />}>
      <JobPageContent />
    </Suspense>
  );
}