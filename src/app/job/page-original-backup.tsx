
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
import { LogOut, UserCog, FileText, Users, Crown, Upload, Play, Sun, Moon, LayoutDashboard, Trash2 } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { getHashColor, getUserColor, getStatusStyle, getStatusVariant } from "@/lib/theme-utils"
import { JobService, Job as ServiceJob } from "@/lib/job-service"
import { UserService } from "@/lib/user-service"
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
import { useToast } from "@/hooks/use-toast";

const ItemTable = dynamic(() => import("@/components/ItemTable").then(mod => ({ default: mod.ItemTable })), {
  loading: () => <div className="animate-pulse h-32 bg-muted rounded">Loading table...</div>
});

import { allItems, FoodItem } from "@/lib/food-data";
import { tabCategories } from "@/lib/menu-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table";





function JobPageContent() {
  const { theme, setTheme } = useTheme();
  const { user, userProfile, isAuthenticated } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const jobId = searchParams.get('id');

  const [mounted, setMounted] = useState(false);
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    const otherItems = items.filter(item => !categories.includes(item.subcategory));
    setItems([...otherItems, ...updatedItems]);
  }, [items]);

  useEffect(() => {
    setMounted(true);
    if (jobId) {
      loadJob();
      loadUsers();
    }
  }, [jobId]);

  // Debug permission checks
  useEffect(() => {
    if (job && userProfile) {
      console.log('Permission Debug:', {
        userProfile: userProfile.id,
        userRole: userProfile.role,
        jobCreator: job.created_by,
        jobOwner: job.owner_id,
        isCreator: userProfile.id === job.created_by,
        isOwner: userProfile.id === job.owner_id,
        isAdmin: userProfile.role === 'admin',
        hasEditPermission: (userProfile.id === job.created_by || userProfile.id === job.owner_id || userProfile.role === 'admin')
      });
    }
  }, [job, userProfile]);

  const loadJob = async () => {
    if (!jobId) return;
    
    try {
      const { job: jobData, error } = await JobService.getJobById(jobId);
      if (error) {
        console.error('Error loading job:', error);
      } else {
        setJob(jobData);
        setSelectedCollaborators(jobData?.collaborators || []);
      }
    } catch (error) {
      console.error('Error loading job:', error);
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

  const updateCollaborators = async () => {
    if (!job || !userProfile) return;

    console.log('Updating collaborators:', {
      jobId: job.id,
      selectedCollaborators,
      userProfile: userProfile?.id,
      isCreator: userProfile?.id === job.created_by,
      isOwner: userProfile?.id === job.owner_id,
      isAdmin: userProfile?.role === 'admin'
    });

    try {
      const { data: updatedJob, error } = await JobService.updateJob(job.id, {
        collaborators: selectedCollaborators
      });

      if (error) {
        console.error('Error updating collaborators:', error);
        toast({
          title: "Error",
          description: `Failed to update team members: ${error}`,
          variant: "destructive",
        });
      } else {
        setJob(updatedJob);
        setCollaboratorsDialog(false);
        toast({
          title: "Success",
          description: "Team members updated successfully",
        });
      }
    } catch (error) {
      console.error('Error updating collaborators:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  const toggleCollaborator = (userId: string) => {
    setSelectedCollaborators(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleTransferOwnership = async () => {
    if (!job || !newOwnerEmail) {
      return;
    }

    try {
      const { data, error } = await JobService.transferOwnership(
        job.id,
        newOwnerEmail
      );

      if (error) {
        console.error('Error transferring ownership:', error);
      } else {
        setTransferOwnershipDialog(false);
        setNewOwnerEmail('');
        await loadJob();
      }
    } catch (error) {
      console.error('Error transferring ownership:', error);
    }
  };

  const handleDeleteJob = async () => {
    if (!job) return;

    try {
      const { error } = await JobService.deleteJob(job.id);

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
        router.push('/dashboard');
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

  if (loading || !job) {
    return (
      <LoadingWithTips
        title="Loading Job Details"
        subtitle="Preparing menu data and collaborator information..."
        tips={jobTips}
        size="md"
        className="h-screen"
      />
    );
  }


  return (
    <main className="h-screen bg-background">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full"
      >
        <ResizablePanel defaultSize={75}>
          <div className="flex flex-col h-full">
            <div className="p-6 pb-0 flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <BackButton />
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-bold text-foreground">{job.venue}</h1>
                      <Badge variant={getStatusVariant(job.status)} style={getStatusStyle(job.status, theme, mounted)}>{job.status}</Badge>
                    </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground">{job.job_id}</p>
                    <div className="flex items-center gap-2">
                      {job.collaborator_users?.map(c => (
                        <Badge key={c.id} className="whitespace-nowrap flex items-center gap-1 border-none" style={getUserColor(c, theme, mounted)} suppressHydrationWarning>
                          {c.full_name}
                          {c.id === job.owner_id && <Crown className="h-3 w-3 text-yellow-500" />}
                        </Badge>
                      ))}
                      <Dialog open={collaboratorsDialog} onOpenChange={setCollaboratorsDialog}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Team Members</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col gap-4">
                            {/* Show all users including creator */}
                            {users.map((userItem) => (
                              <div key={userItem.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar className="hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
                                    <AvatarFallback style={getUserColor(userItem, theme, mounted)} suppressHydrationWarning>
                                      {userItem.initials || UserService.generateInitials(userItem.full_name) || 'U'}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">
                                      {userItem.full_name}
                                      {userItem.id === job.created_by && ' (Creator)'}
                                      {userItem.id === userProfile?.id && ' (You)'}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{userItem.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant={userItem.id === job.owner_id ? "secondary" : "ghost"}
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    title={userItem.id === job.owner_id ? 'Current Owner' : 'Click to Transfer Ownership'}
                                    onClick={async () => {
                                      if (userItem.id !== job.owner_id && (userProfile?.id === job.created_by || userProfile?.id === job.owner_id || userProfile?.role === 'admin')) {
                                        // Directly transfer ownership
                                        const { data, error } = await JobService.transferOwnership(
                                          job.id,
                                          userItem.email
                                        );
                                        if (!error) {
                                          await loadJob(); // Refresh job data
                                          // Update selected collaborators to reflect new owner
                                          if (!selectedCollaborators.includes(userItem.id)) {
                                            setSelectedCollaborators([...selectedCollaborators, userItem.id]);
                                          }
                                        } else {
                                          console.error('Error transferring ownership:', error);
                                        }
                                      }
                                    }}
                                    disabled={userItem.id === job.owner_id || (!userProfile || (userProfile.id !== job.created_by && userProfile.id !== job.owner_id && userProfile.role !== 'admin'))}
                                  >
                                    <Crown className={`h-4 w-4 ${userItem.id === job.owner_id ? 'text-yellow-500' : 'text-gray-400'}`} />
                                  </Button>
                                  <Switch
                                    checked={selectedCollaborators.includes(userItem.id)}
                                    onCheckedChange={() => toggleCollaborator(userItem.id)}
                                    disabled={userItem.id === job.owner_id || (!userProfile || (userProfile.id !== job.created_by && userProfile.id !== job.owner_id && userProfile.role !== 'admin'))}
                                  />
                                </div>
                              </div>
                            ))}
                            {(userProfile?.id === job.created_by || userProfile?.id === job.owner_id || userProfile?.role === 'admin') && (
                              <Button
                                onClick={updateCollaborators}
                                className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                              >
                                Update Team
                              </Button>
                            )}
                          </div>
                          </DialogContent>
                        </Dialog>
                    </div>
                  </div>
                </div>
                </div>
                {/* Delete button for job owner or admin */}
                {(userProfile?.id === job.owner_id || userProfile?.role === 'admin') && (
                  <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-5 w-5" />
                      </Button>
                    </DialogTrigger>
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
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              setDeleteDialog(false);
                              handleDeleteJob();
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {extractionStarted && (
                <Tabs defaultValue={tabs[0]} className="w-full mt-4">
                  <TabsList className="bg-transparent p-0 px-6 flex-wrap gap-1 h-auto">
                    {tabs.map((tab) => (
                      <TabsTrigger key={tab} value={tab}>{tab}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              )}
            </div>
            <div className="flex-grow overflow-y-auto">
              {extractionStarted ? (
                <ScrollArea className="h-full">
                  <div className="sticky top-0 bg-background z-10 px-6 pt-4">
                    <div className="w-full pr-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[20%]">Name</TableHead>
                            <TableHead className="w-[15%]">Subcategory</TableHead>
                            <TableHead className="w-[20%]">Menu(s)</TableHead>
                            <TableHead className="w-[20%]">size(s)</TableHead>
                            <TableHead className="w-[20%]">Modifier Group(s)</TableHead>
                            <TableHead className="w-[5%]"></TableHead>
                          </TableRow>
                        </TableHeader>
                      </Table>
                    </div>
                  </div>
                  <div className="px-6">
                    <Tabs defaultValue={tabs[0]} className="w-full">
                      {Object.keys(tabCategories).map(tabName => (
                        <TabsContent key={tabName} value={tabName} className="m-0">
                          <ItemTable 
                            items={getItemsForTab(tabName)}
                            onItemsChange={(updatedItems) => handleItemsChange(updatedItems, tabName)}
                          />
                        </TabsContent>
                      ))}
                      <TabsContent value="Menu Structure">
                          <div className="flex flex-1 items-center justify-center w-full rounded-lg bg-muted/20 mt-4 p-8">
                            <p className="text-gray-600">Menu Structure details will go here.</p>
                          </div>
                        </TabsContent>
                        <TabsContent value="Modifiers">
                          <div className="flex flex-1 items-center justify-center w-full rounded-lg bg-muted/20 mt-4 p-8">
                            <p className="text-gray-600">Modifiers details will go here.</p>
                          </div>
                        </TabsContent>
                    </Tabs>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-1 items-center justify-center w-full h-full">
                  <p className="text-gray-600">
                    Click &quot;Start Extraction&quot; to begin.
                  </p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25} className="bg-secondary dark:bg-zinc-900">
          <div className="flex flex-col items-end p-6 gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar className="hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
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
              <div className="flex flex-col items-center justify-center w-full h-32 rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/50">
                  <Upload className="h-8 w-8 text-primary" />
                  <p className="text-sm text-primary mt-2">
                    Upload PDF, spreadsheet, or images
                  </p>
                  <input type="file" className="hidden" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" multiple />
              </div>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setExtractionStarted(true)}>
                <Play />
                Start Extraction
              </Button>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}

export default function JobPage() {
  return (
    <Suspense fallback={
      <LoadingWithTips
        title="Initializing Job View"
        subtitle="Setting up the workspace..."
        tips={jobTips}
        size="md"
        className="h-screen"
      />
    }>
      <JobPageContent />
    </Suspense>
  );
}
