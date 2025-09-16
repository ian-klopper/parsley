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
import { Users, Crown, Upload, Play, Trash2, FileText, Image, FileSpreadsheet, Table as TableIcon, File, Download, X } from "lucide-react"
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
import { useTheme } from "next-themes";
import { LoadingWithTips } from "@/components/LoadingWithTips";
import { jobTips } from "@/lib/loading-tips";

// React Query hooks - instant updates!
import { useJob, useUpdateJob, useDeleteJob, useTransferOwnership } from "@/hooks/queries/useJobs"
import { useUsers, useActiveUsers } from "@/hooks/queries/useUsers"
import { useFileUpload } from "@/hooks/useFileUpload"
import { FilePreviewPanel } from "@/components/file-preview/FilePreviewPanel"

const ItemTable = dynamic(() => import("@/components/ItemTable").then(mod => ({ default: mod.ItemTable })), {
  loading: () => <div className="animate-pulse h-32 bg-muted rounded">Loading table...</div>
});

import { allItems, FoodItem } from "@/lib/food-data";
import { tabCategories } from "@/lib/menu-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { UserService } from "@/lib/user-service";

// Helper function to get icon component from string
function getFileIconComponent(iconName: string) {
  switch (iconName) {
    case 'FileText': return FileText;
    case 'Image': return Image;
    case 'FileSpreadsheet': return FileSpreadsheet;
    case 'Table': return TableIcon;
    default: return File;
  }
}

function JobPageContent() {
  const { user, userProfile, isAuthenticated } = useAuth();
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const router = useRouter();
  const jobId = searchParams.get('id');

  // React Query hooks with caching and optimistic updates
  const { data: job, isLoading: jobLoading, error: jobError } = useJob(jobId || '');
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: activeUsers = [] } = useActiveUsers();

  // File upload hook
  const {
    documents,
    isLoadingDocuments,
    uploadFile,
    deleteDocument,
    getDownloadUrl,
    uploadState,
    isUploading,
    uploadProgress,
    uploadError,
    isDeleting,
    formatFileSize,
    getFileIcon
  } = useFileUpload(jobId || '');
  const updateJobMutation = useUpdateJob();
  const deleteJobMutation = useDeleteJob();
  const transferOwnershipMutation = useTransferOwnership();

  const [mounted, setMounted] = useState(false);
  const [collaboratorsDialog, setCollaboratorsDialog] = useState(false);
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<string>('');
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

  // Initialize selected collaborators and owner when job loads
  useEffect(() => {
    if (job && job.collaborator_users) {
      setSelectedCollaborators(job.collaborator_users.map((c: any) => c.id));
      setSelectedOwner(job.owner_id || '');
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
    const updateData: any = { collaborators: selectedCollaborators };

    // If owner has changed, also update owner
    if (selectedOwner && selectedOwner !== job.owner_id) {
      updateData.owner_id = selectedOwner;
    }

    updateJobMutation.mutate({
      id: job.id,
      data: updateData
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


  const handleCollaboratorClick = (user: any) => {
    if (!canEdit) return;

    const isSelected = selectedCollaborators.includes(user.id);
    const isOwner = selectedOwner === user.id;

    if (isSelected) {
      // Cannot remove collaborator status if they are the owner
      if (isOwner) {
        return; // Do nothing - owner must remain a collaborator
      }
      setSelectedCollaborators(prev => prev.filter(id => id !== user.id));
    } else {
      setSelectedCollaborators(prev => [...prev, user.id]);
    }
  };

  const handleOwnerClick = (user: any) => {
    if (!canEdit) return;

    // If user is not a collaborator, make them one first
    if (!selectedCollaborators.includes(user.id)) {
      setSelectedCollaborators(prev => [...prev, user.id]);
    }

    // Toggle owner selection
    if (selectedOwner === user.id) {
      setSelectedOwner('');
    } else {
      setSelectedOwner(user.id);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={75} minSize={50} className="h-full">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-4">
                <div className="flex items-center gap-4">
                  <BackButton />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-semibold">{job.venue}</h1>
                      <Badge variant={getStatusVariant(job.status)}>
                        {job.status}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Job ID: {job.job_id}
                      </span>
                    </div>
                    {/* User fullname badges */}
                    <div className="flex items-center gap-2 mt-2">
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
                      </div>
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setCollaboratorsDialog(true)}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <Tabs defaultValue="Food" className="h-full flex flex-col">
                  <TabsList className="flex flex-wrap gap-1 mb-4 h-auto bg-transparent p-0 justify-start">
                    {tabs.map((tab) => (
                      <TabsTrigger key={tab} value={tab} className="text-xs flex-shrink-0">
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
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle={false} />

          <ResizablePanel defaultSize={25} minSize={20} className="h-full">
            <div className="h-full flex flex-col border-l">
              <div className="flex justify-end p-4">
                <UserNavigation />
              </div>
              <div className="flex-1 overflow-auto p-4 pt-0">
                <div className="space-y-4">
                  {/* Upload Area */}
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors dark:bg-black ${
                    isUploading ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}>
                    <input
                      type="file"
                      id="file-upload-job"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadFile(file);
                          // Reset input
                          e.target.value = '';
                        }
                      }}
                      disabled={isUploading}
                    />
                    <label
                      htmlFor="file-upload-job"
                      className={`flex flex-col items-center gap-2 ${
                        isUploading ? 'cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <Upload className={`w-8 h-8 ${
                        isUploading ? 'text-primary animate-pulse' : 'text-muted-foreground'
                      }`} />
                      <div>
                        <p className="text-sm font-medium">
                          {isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}
                        </p>
                        <p className="text-xs text-muted-foreground">PDF, PNG, JPG, Excel, CSV (max 10MB)</p>
                      </div>
                    </label>

                    {/* Upload Progress */}
                    {isUploading && (
                      <div className="mt-4">
                        <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                          <div
                            className="bg-primary h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{uploadProgress}%</p>
                      </div>
                    )}

                    {/* Upload Error */}
                    {uploadError && (
                      <div className="mt-4 text-xs text-destructive">
                        {uploadError}
                      </div>
                    )}
                  </div>

                  {/* File Previews */}
                  <FilePreviewPanel jobId={jobId} />
                </div>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Collaborators Dialog */}
      <Dialog open={collaboratorsDialog} onOpenChange={setCollaboratorsDialog}>
        <DialogContent className="max-w-md dark:bg-neutral-900">
          <DialogHeader>
            <DialogTitle>Edit Team Members</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Select collaborators and choose an owner (crown icon)</p>
            <div className="space-y-2 max-h-64 overflow-y-auto p-2 dark:bg-black rounded-lg">
              {activeUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No team members available</p>
              ) : activeUsers.map((user) => {
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
                      disabled={isOwner}
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
                      title={!isCollaborator && !isOwner ? "Click to make collaborator and set as owner" : "Set as owner"}
                    >
                      <Crown className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
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
        <DialogContent className="dark:bg-neutral-900">
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
        <DialogContent className="dark:bg-neutral-900">
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