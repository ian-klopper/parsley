
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
import { JobService, Job as ServiceJob } from "@/lib/job-service"
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
import { UserService } from "@/lib/user-service"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { PageLayout } from "@/components/PageLayout"
import { LoadingWithTips } from "@/components/LoadingWithTips"
import Link from "next/link"






export default function Home() {
  const { theme, setTheme } = useTheme();
  const { user, userProfile, isAuthenticated, isPendingApproval, hasAccess } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [mounted, setMounted] = useState(false);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createJobDialog, setCreateJobDialog] = useState(false);
  const [newJob, setNewJob] = useState({ venue: '', jobId: '' });
  const [selectedOwner, setSelectedOwner] = useState<string>('');
  const [selectedCollaborators, setSelectedCollaborators] = useState<string[]>([]);
  const [transferOwnershipDialog, setTransferOwnershipDialog] = useState(false);
  const [selectedJobForTransfer, setSelectedJobForTransfer] = useState<ServiceJob | null>(null);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [deleteJobDialog, setDeleteJobDialog] = useState(false);
  const [selectedJobForDelete, setSelectedJobForDelete] = useState<ServiceJob | null>(null);

  useEffect(() => {
    setMounted(true);
    loadJobs();
    loadUsers();
  }, []);

  // Initialize owner and collaborator when dialog opens or user changes
  useEffect(() => {
    if (createJobDialog && userProfile) {
      // Set current user's profile ID as default owner and collaborator
      setSelectedOwner(userProfile.id);
      setSelectedCollaborators([userProfile.id]);
    }
  }, [createJobDialog, userProfile]);

  const loadJobs = async () => {
    try {
      const { jobs: jobsData, error } = await JobService.getAllJobs();
      if (error) {
        console.error('Error loading jobs:', error);
      } else {
        console.log('Loaded jobs:', jobsData);
        // Check if any jobs have collaborators
        jobsData?.forEach(job => {
          console.log(`Job ${job.id} (${job.venue}) has ${job.collaborator_users?.length || 0} collaborators:`, job.collaborator_users);
        });
        setJobs(jobsData || []);
      }
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: usersData, error } = await UserService.getAllUsers();
      if (error) {
        console.error('Error loading users:', error);
      } else {
        setUsers(usersData || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const handleCreateJob = async () => {
    if (!userProfile || !newJob.venue || !newJob.jobId) {
      toast({
        title: "Error",
        description: !userProfile ? "User profile not loaded" : "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Determine the actual owner (either selected owner or current user profile)
    const actualOwner = selectedOwner || userProfile.id;

    // Ensure owner is always in collaborators list
    let finalCollaborators = [...new Set([...selectedCollaborators, actualOwner])];

    // Double-check that there's at least one collaborator
    if (finalCollaborators.length === 0 || (selectedCollaborators.length === 0 && !actualOwner)) {
      // Fallback: always include the current user profile as a collaborator
      finalCollaborators = [userProfile.id];
      console.warn('No collaborators selected, defaulting to current user profile:', userProfile.id);
    }

    try {
      const jobData: any = {
        venue: newJob.venue,
        job_id: newJob.jobId,
        collaborators: finalCollaborators
      };

      // Add owner_id if a different owner is selected
      if (selectedOwner && selectedOwner !== userProfile.id) {
        jobData.owner_id = selectedOwner;
      }

      const { data: job, error } = await JobService.createJob(jobData);

      if (error) {
        console.error('Error creating job:', error);

        // Check for specific error types
        let errorMessage = 'Failed to create job';
        if (error.includes('duplicate key value') || error.includes('job_id') || error.includes('unique')) {
          errorMessage = `Job ID "${newJob.jobId}" already exists. Please choose a different Job ID.`;
        } else if (error.includes('venue')) {
          errorMessage = 'Venue name is required.';
        } else {
          errorMessage = error;
        }

        toast({
          title: "Error Creating Job",
          description: errorMessage,
          variant: "destructive",
        });
      } else if (job) {
        toast({
          title: "Job Created",
          description: `Successfully created job "${job.venue}" with ID ${job.job_id}`,
          variant: "default",
        });
        setCreateJobDialog(false);
        setNewJob({ venue: '', jobId: '' });
        setSelectedOwner('');
        setSelectedCollaborators([]);
        // Navigate to the new job page
        router.push(`/job?id=${job.id}`);
      }
    } catch (error) {
      console.error('Error creating job:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      toast({
        title: "Error Creating Job",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleTransferOwnership = async () => {
    if (!selectedJobForTransfer || !newOwnerEmail) {
      return;
    }

    try {
      const { data, error } = await JobService.transferOwnership(
        selectedJobForTransfer.id,
        newOwnerEmail
      );

      if (error) {
        console.error('Error transferring ownership:', error);
        alert(`Error transferring ownership: ${error}`);
      } else {
        console.log('Ownership transferred successfully:', data);
        setTransferOwnershipDialog(false);
        setSelectedJobForTransfer(null);
        setNewOwnerEmail('');
        loadJobs(); // Refresh the jobs list
      }
    } catch (error) {
      console.error('Error transferring ownership:', error);
      alert('Failed to transfer ownership. Please try again.');
    }
  };

  const openTransferDialog = (job: ServiceJob) => {
    setSelectedJobForTransfer(job);
    setTransferOwnershipDialog(true);
  };

  const canTransferOwnership = (job: ServiceJob): boolean => {
    if (!userProfile) return false;
    return userProfile.role === 'admin' || job.created_by === userProfile.id || job.owner_id === userProfile.id;
  };

  const handleDeleteJob = async () => {
    if (!selectedJobForDelete) return;

    try {
      const { error } = await JobService.deleteJob(selectedJobForDelete.id);

      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Job deleted successfully",
        });
        setDeleteJobDialog(false);
        setSelectedJobForDelete(null);
        loadJobs(); // Refresh the jobs list
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: "Failed to delete job",
        variant: "destructive",
      });
    }
  };

  const toggleCollaborator = (userId: string) => {
    setSelectedCollaborators(prev => {
      if (prev.includes(userId)) {
        // If trying to remove the owner as collaborator, prevent it
        if (userId === selectedOwner) {
          return prev; // Don't allow removing owner from collaborators
        }
        return prev.filter(id => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  const handleOwnerSelection = (userId: string) => {
    setSelectedOwner(userId);
    // Auto-assign the new owner as collaborator
    setSelectedCollaborators(prev => {
      if (!prev.includes(userId)) {
        return [...prev, userId];
      }
      return prev;
    });
  };

  if (loading) {
    return (
      <LoadingWithTips size="md" className="h-screen" />
    );
  }

  // Show pending approval message for users without profile or pending approval
  if (isAuthenticated && isPendingApproval) {
    return (
      <LoadingWithTips size="md" className="h-screen" />
    );
  }

  return (
    <main className="h-screen bg-background">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full"
      >
        <ResizablePanel defaultSize={75}>
          <ScrollArea className="h-full px-6">
            <div className="flex flex-col h-full items-start justify-start py-6 gap-4">
              <div className="flex items-center gap-4">
                <Link href="/">
                  <ArrowLeft />
                </Link>
                <h1 className="text-2xl font-bold text-foreground">Jobs</h1>
              </div>
              <div className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Job</TableHead>
                      <TableHead>Collaborators</TableHead>
                      <TableHead>Created by</TableHead>
                      <TableHead>Last activity</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <TableRow key={job.id} className="border-b-0 hover:bg-muted/50 cursor-pointer group transition-colors" onClick={() => router.push(`/job?id=${job.id}`)}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{job.venue}</span>
                            <Badge variant={getStatusVariant(job.status)} style={getStatusStyle(job.status, theme, mounted)}>{job.status}</Badge>
                          </div>
                          <div className="text-sm text-gray-600">{job.job_id}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {job.collaborator_users && job.collaborator_users.length > 0 ? (
                              job.collaborator_users.map(c => (
                                <Badge key={c.id} className="whitespace-nowrap flex items-center gap-1 border-none" style={getUserColor(c, theme, mounted)} suppressHydrationWarning>
                                  {c.full_name || c.email || 'Unknown'}
                                  {c.id === job.owner_id && <Crown className="h-3 w-3 text-yellow-500" />}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">No collaborators</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{job.creator?.full_name}</TableCell>
                        <TableCell>{new Date(job.last_activity).toLocaleDateString()}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            {canTransferOwnership(job) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openTransferDialog(job)}
                                title="Transfer Ownership"
                              >
                                <Crown className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                console.log('Delete clicked for job:', job.id, 'User:', userProfile?.id, 'Owner:', job.owner_id, 'Role:', userProfile?.role);
                                console.log('Job data:', job);
                                console.log('User profile data:', userProfile);
                                setSelectedJobForDelete(job);
                                setDeleteJobDialog(true);
                              }}
                              className="hover:bg-destructive/10"
                              title="Delete Job"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ScrollArea>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25} className="bg-secondary dark:bg-zinc-900">
          <div className="flex flex-col items-end p-6 gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar className="hover:ring-2 hover:ring-black hover:ring-offset-2 transition-all">
                  <AvatarFallback style={getUserColor(userProfile, theme, mounted)} suppressHydrationWarning>
                    {userProfile?.initials || UserService.generateInitials(userProfile?.full_name) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
                  {theme === 'light' ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
                  <span>{theme === 'light' ? 'Dark' : 'Light'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/dashboard'}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>Home</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/admin'}>
                  <UserCog className="mr-2 h-4 w-4" />
                  <span>Admin</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/logs'}>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Logs</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-full flex flex-col gap-4">
              <Dialog open={createJobDialog} onOpenChange={setCreateJobDialog}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                    <PlusCircle />
                    New Job
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Job</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <div>
                      <Label htmlFor="job-name">Venue Name</Label>
                      <Input 
                        id="job-name" 
                        placeholder="Enter venue name" 
                        value={newJob.venue}
                        onChange={(e) => setNewJob(prev => ({ ...prev, venue: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="job-id">Job ID</Label>
                      <Input 
                        id="job-id" 
                        placeholder="Enter job ID" 
                        value={newJob.jobId}
                        onChange={(e) => setNewJob(prev => ({ ...prev, jobId: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Team Members</Label>
                      <div className="flex flex-col gap-4 mt-2">
                        {/* Show current user first */}
                        {user && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="hover:ring-2 hover:ring-black hover:ring-offset-2 transition-all">
                                <AvatarFallback style={getUserColor(user, theme, mounted)} suppressHydrationWarning>
                                  {user.initials || UserService.generateInitials(user.full_name) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{user.full_name || user.email} (You)</p>
                                <p className="text-sm text-gray-600">Job Creator</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleOwnerSelection(user.id)}
                              >
                                <Crown className={`h-4 w-4 ${!selectedOwner || selectedOwner === user.id ? 'text-yellow-500' : 'text-gray-400'}`} />
                              </Button>
                              <Switch
                                checked={selectedCollaborators.includes(user.id)}
                                onCheckedChange={() => toggleCollaborator(user.id)}
                                disabled={selectedOwner === user.id}
                              />
                            </div>
                          </div>
                        )}
                        {/* Show other users - filter by email to avoid duplicates */}
                        {users.filter(u => u.email !== user?.email).map((userItem) => (
                          <div key={userItem.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Avatar className="hover:ring-2 hover:ring-black hover:ring-offset-2 transition-all">
                                <AvatarFallback style={getUserColor(userItem, theme, mounted)} suppressHydrationWarning>
                                  {userItem.initials || UserService.generateInitials(userItem.full_name) || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{userItem.full_name}</p>
                                <p className="text-sm text-gray-600">{userItem.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleOwnerSelection(userItem.id)}
                              >
                                <Crown className={`h-4 w-4 ${selectedOwner === userItem.id ? 'text-yellow-500' : 'text-gray-400'}`} />
                              </Button>
                              <Switch
                                checked={selectedCollaborators.includes(userItem.id)}
                                onCheckedChange={() => toggleCollaborator(userItem.id)}
                                disabled={selectedOwner === userItem.id}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center w-full h-32 rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/50">
                      <Upload className="h-8 w-8 text-primary" />
                      <p className="text-sm text-primary mt-2">
                        Upload PDF, spreadsheet, or images
                      </p>
                      <input type="file" className="hidden" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" multiple />
                    </div>
                    <Button
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                      onClick={handleCreateJob}
                      disabled={!newJob.venue || !newJob.jobId || !userProfile}
                    >
                      Create Job
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Transfer Ownership Dialog */}
              <Dialog open={transferOwnershipDialog} onOpenChange={setTransferOwnershipDialog}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Transfer Job Ownership</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-sm text-gray-600 mb-4">
                        Transfer ownership of &quot;{selectedJobForTransfer?.venue}&quot; to another user.
                      </p>
                      <Label htmlFor="new-owner-email">New Owner Email</Label>
                      <Input
                        id="new-owner-email"
                        placeholder="Enter user email"
                        type="email"
                        value={newOwnerEmail}
                        onChange={(e) => setNewOwnerEmail(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setTransferOwnershipDialog(false);
                          setSelectedJobForTransfer(null);
                          setNewOwnerEmail('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={handleTransferOwnership}
                        disabled={!newOwnerEmail || !selectedJobForTransfer}
                      >
                        <Crown className="mr-2 h-4 w-4" />
                        Transfer Ownership
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
                      Are you sure you want to delete &quot;{selectedJobForDelete?.venue}&quot;? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setDeleteJobDialog(false);
                          setSelectedJobForDelete(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={handleDeleteJob}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
