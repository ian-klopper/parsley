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
import { useAuth } from "@/contexts/AuthContext"
import { BackButton } from "@/components/BackButton"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getStatusVariant, getUserColor } from "@/lib/theme-utils"
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
import { formatCost, getCostColor, estimateExtractionCost } from "@/lib/extraction-cost-utils";
import { useQueryClient } from "@tanstack/react-query";

// React Query hooks - instant updates!
import { useJob, useUpdateJob, useDeleteJob, useTransferOwnership, useJobExtractionResults, useStartExtraction } from "@/hooks/queries/useJobs"
import { useUsers } from "@/hooks/queries/useUsers"
import { useFileUpload } from "@/hooks/useFileUpload"
import { useToast } from "@/hooks/use-toast"
import { FilePreviewPanel } from "@/components/file-preview/FilePreviewPanel"

const ItemTable = dynamic(() => import("@/components/ItemTable").then(mod => ({ default: mod.ItemTable })), {
  loading: () => <div className="animate-pulse h-32 bg-muted rounded">Loading table...</div>
});

import { FoodItem } from "@/lib/food-data";
import { tabCategories, allTabs } from "@/lib/menu-data";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const jobId = searchParams.get('id');

  // React Query hooks with caching and optimistic updates
  const { data: job, isLoading: jobLoading, error: jobError } = useJob(jobId || '');
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const { data: extractionResults, isLoading: extractionLoading } = useJobExtractionResults(jobId || '');
  const startExtractionMutation = useStartExtraction();

  // File upload hook
  const {
    documents,
    isLoadingDocuments,
    uploadFile,
    uploadFiles,
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
  const [items, setItems] = useState<FoodItem[]>([]);
  const [organizedData, setOrganizedData] = useState<any>({});
  const [extractionStarted, setExtractionStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transferOwnershipDialog, setTransferOwnershipDialog] = useState(false);
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [latestExtractionData, setLatestExtractionData] = useState<any>(null);

  // Progress tracking state
  const [extractionProgress, setExtractionProgress] = useState(0);
  const [extractionStatus, setExtractionStatus] = useState('');
  const [extractionPhase, setExtractionPhase] = useState('');
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  const tabs = allTabs;

  const getItemsForTab = useCallback((tab: string) => {
    // For organized data, return data directly from the tab
    if (organizedData && organizedData[tab]) {
      return organizedData[tab] || [];
    }

    // Fallback to legacy filtering for backward compatibility
    const categories = tabCategories[tab];
    if (!categories) return [];
    return items.filter(item => categories.includes(item.subcategory));
  }, [organizedData, items]);

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

  // Derived state for extraction completion
  const hasExtractionResults = extractionResults?.success && extractionResults?.data?.hasResults;
  const isExtractionComplete = job?.status === 'complete' && hasExtractionResults;

  // Calculate total item count from organized data or items directly
  const extractionItemCount = organizedData?.overview?.totalItems ||
    (organizedData?.items?.length) ||
    (extractionResults?.data?.items?.length) ||
    0;

  // Update organized data and items when extraction results load - enhanced for real-time updates
  useEffect(() => {
    console.log('🔄 Extraction results updated:', extractionResults?.success, extractionResults?.data?.hasResults);

    if (extractionResults?.success && extractionResults?.data) {
      const organized = extractionResults.data.organizedData;
      const items = extractionResults.data.items || [];

      console.log('📊 Setting organized data with', Object.keys(organized || {}).length, 'tabs and', items.length, 'items');

      setOrganizedData(organized || {});
      setItems(items);

      // If extraction just completed, reset processing state
      if (extractionResults.data.hasResults && isProcessing) {
        console.log('✅ Extraction completed, resetting processing state');
        setIsProcessing(false);
        setExtractionStarted(false);
      }
    }
  }, [extractionResults, isProcessing]);

  // Polling logic for extraction progress
  useEffect(() => {
    if (isProcessing && jobId) {
      console.log('🔄 Starting extraction polling...');

      // Start polling immediately
      const pollStatus = async () => {
        try {
          // Invalidate and refetch job data
          await queryClient.invalidateQueries({
            queryKey: ['job', jobId],
            exact: true
          });

          // Check if job status has changed
          const updatedJob = queryClient.getQueryData(['job', jobId]);
          if (updatedJob && (updatedJob as any).status === 'complete') {
            console.log('✅ Job completed, stopping polling');
            setIsProcessing(false);
            setExtractionStarted(false);
            setExtractionProgress(100);
            setExtractionStatus('Extraction completed successfully!');
            setExtractionPhase('');

            // Stop polling
            if (pollingInterval) {
              clearInterval(pollingInterval);
              setPollingInterval(null);
            }
            return;
          }

          // Update progress based on time elapsed (since we don't have real-time phase data)
          const elapsed = Date.now() - (job?.created_at ? new Date(job.created_at).getTime() : Date.now());
          const estimatedProgress = Math.min(95, Math.floor((elapsed / 30000) * 100)); // Estimate 30 seconds total

          // Only update progress if it has actually changed to avoid unnecessary re-renders
          setExtractionProgress(prev => {
            if (prev !== estimatedProgress) {
              return estimatedProgress;
            }
            return prev;
          });

          // Update status messages based on progress
          let newStatus = '';
          let newPhase = '';

          if (estimatedProgress < 20) {
            newStatus = 'Preparing documents...';
            newPhase = 'Phase 0: Document Preparation';
          } else if (estimatedProgress < 50) {
            newStatus = 'Analyzing menu structure...';
            newPhase = 'Phase 1: Structure Analysis';
          } else if (estimatedProgress < 80) {
            newStatus = 'Extracting menu items...';
            newPhase = 'Phase 2: Item Extraction';
          } else {
            newStatus = 'Enriching with modifiers...';
            newPhase = 'Phase 3: Modifier Enrichment';
          }

          // Only update status if it has changed
          setExtractionStatus(prev => prev !== newStatus ? newStatus : prev);
          setExtractionPhase(prev => prev !== newPhase ? newPhase : prev);

        } catch (error) {
          console.error('Polling error:', error);
        }
      };

      // Poll immediately
      pollStatus();

      // Set up interval polling every 2 seconds
      const interval = setInterval(pollStatus, 2000);
      setPollingInterval(interval);

      // Cleanup function
      return () => {
        if (interval) {
          clearInterval(interval);
          setPollingInterval(null);
        }
      };
    } else {
      // Reset progress when not processing
      setExtractionProgress(0);
      setExtractionStatus('');
      setExtractionPhase('');

      // Clear any existing polling
      if (pollingInterval) {
        clearInterval(pollingInterval);
        setPollingInterval(null);
      }
    }
  }, [isProcessing, jobId, job?.created_at, queryClient]);

  if (!mounted || jobLoading || usersLoading) {
    return <LoadingWithTips />;
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

  // Check for temporary IDs and redirect to dashboard
  if (jobId.startsWith('temp-')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Job is still being created...</p>
          <p className="text-sm text-muted-foreground mb-4">Please wait a moment and try again.</p>
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

  const handleStartExtraction = async () => {
    if (!documents || documents.length === 0 || !job?.id) return;

    setIsProcessing(true);
    setExtractionStarted(true);

    try {
      const result = await startExtractionMutation.mutateAsync(job.id);

      // Store the latest extraction data with phase breakdown
      if (result?.data) {
        setLatestExtractionData(result.data);
      }

      // Update organized data and items immediately from POST response for instant UI refresh
      const organized = result?.data?.organizedData;
      if (organized && typeof organized === 'object') {
        console.log('📊 Extraction completed: setting organized data with', Object.keys(organized).length, 'tabs');
        setOrganizedData(organized);
        const allItems: FoodItem[] = [];
        Object.entries(organized).forEach(([tabName, tabData]) => {
          if (Array.isArray(tabData) && tabName !== 'Menu Structure') {
            allItems.push(...(tabData as FoodItem[]));
          }
        });
        setItems(allItems);
      } else if (result?.data?.items && Array.isArray(result.data.items)) {
        // Fallback: if only items returned
        console.log('📊 Extraction completed: setting', result.data.items.length, 'items');
        setItems(result.data.items);
      }

      // Force query invalidation to ensure real-time updates
      console.log('🔄 Forcing query invalidation after extraction completion');
      queryClient.invalidateQueries({
        queryKey: ['jobs', jobId, 'extraction'],
        exact: true
      });
    } catch (error) {
      // Error is already handled by the mutation's onError
      console.error('Extraction error:', error);
    } finally {
      setIsProcessing(false);
    }
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
          <ResizablePanel defaultSize={75} minSize={50} className="h-full bg-background">
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
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-auto">
                  <div className="p-4">
                    <Tabs defaultValue="Food">
                      <div className="sticky top-0 z-10 bg-background pb-4">
                        <TabsList className="flex flex-wrap gap-1 h-auto bg-transparent p-0 justify-start">
                          {tabs.map((tab) => (
                            <TabsTrigger key={tab} value={tab} className="text-xs flex-shrink-0">
                              {tab}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>
                      {tabs.map((tab) => (
                        <TabsContent key={tab} value={tab} className="mt-4">
                          {tab === 'Menu Structure' ? (
                            <div className="space-y-2">
                              <h3 className="font-medium">Menu Names</h3>
                              <div className="border rounded p-4 bg-gray-50">
                                {getItemsForTab(tab).length > 0 ? (
                                  <ul className="space-y-1">
                                    {getItemsForTab(tab).map((menu: string, index: number) => (
                                      <li key={index} className="text-sm">• {menu}</li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-sm text-gray-500">No menu names found</p>
                                )}
                              </div>
                            </div>
                          ) : tab === 'Modifiers' ? (
                            <div className="space-y-4">
                              <div>
                                <h3 className="font-medium mb-2">Food Modifiers</h3>
                                <div className="border rounded p-4 bg-gray-50">
                                  {getItemsForTab(tab)?.food?.length > 0 ? (
                                    <div className="space-y-3">
                                      {getItemsForTab(tab).food.map((group: any, index: number) => (
                                        <div key={index} className="border-b pb-2 last:border-b-0">
                                          <h4 className="font-medium text-sm">{group.name}</h4>
                                          {group.options?.length > 0 && (
                                            <ul className="mt-1 space-y-1">
                                              {group.options.map((option: any, optIndex: number) => (
                                                <li key={optIndex} className="text-xs text-gray-600 ml-2">
                                                  • {option.name} {option.price && `(+$${option.price})`}
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">No food modifiers found</p>
                                  )}
                                </div>
                              </div>
                              <div>
                                <h3 className="font-medium mb-2">Beverage Modifiers</h3>
                                <div className="border rounded p-4 bg-gray-50">
                                  {getItemsForTab(tab)?.beverage?.length > 0 ? (
                                    <div className="space-y-3">
                                      {getItemsForTab(tab).beverage.map((group: any, index: number) => (
                                        <div key={index} className="border-b pb-2 last:border-b-0">
                                          <h4 className="font-medium text-sm">{group.name}</h4>
                                          {group.options?.length > 0 && (
                                            <ul className="mt-1 space-y-1">
                                              {group.options.map((option: any, optIndex: number) => (
                                                <li key={optIndex} className="text-xs text-gray-600 ml-2">
                                                  • {option.name} {option.price && `(+$${option.price})`}
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-gray-500">No beverage modifiers found</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <ItemTable
                              items={getItemsForTab(tab)}
                              onItemsChange={(updated) => handleItemsChange(updated, tab)}
                            />
                          )}
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                </div>
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle={false} />

          <ResizablePanel defaultSize={25} minSize={20} className="h-full">
            <div className="h-full flex flex-col border-l">
              <ScrollArea key={`scroll-${jobId}-${isProcessing}`} className="flex-1">
                <div className="p-4 space-y-4">
                  {/* User Navigation */}
                  <div className="flex justify-end">
                    <UserNavigation />
                  </div>
                  {/* Upload Area */}
                  <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors dark:bg-black ${
                    isUploading ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}>
                    <input
                      type="file"
                      id="file-upload-job"
                      className="hidden"
                      accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.csv"
                      multiple
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files && files.length > 0) {
                          uploadFiles(files);
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
                        <p className="text-xs text-muted-foreground">PDF, PNG, JPG, Excel, CSV (max 10MB each) • Multiple files supported</p>
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

                  {/* Extraction Section */}
                  <div className="space-y-3">
                    {/* Extraction Button */}
                    <button
                      onClick={handleStartExtraction}
                      disabled={!documents || documents.length === 0 || isProcessing}
                      className={`w-full py-3 px-4 rounded-lg font-medium transition-all relative overflow-hidden ${
                        !documents || documents.length === 0 || isProcessing
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : isExtractionComplete
                          ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                          : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
                      }`}
                    >
                      {isProcessing ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-white rounded-full animate-spin"></div>
                          <span>Processing...</span>
                        </div>
                      ) : isExtractionComplete ? (
                        <div className="flex items-center justify-center gap-2">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4h12v2H4zM4 9h12v2H4zM4 14h12v2H4z" />
                          </svg>
                          Retry Extraction ({extractionItemCount} items found)
                        </div>
                      ) : (
                        'Start Extraction'
                      )}
                    </button>

                    {/* Progress Bar - Only show during processing */}
                    {isProcessing && (
                      <div className="space-y-2">
                        <Progress value={extractionProgress} className="w-full h-2" />
                        <div className="text-xs text-center text-muted-foreground">
                          {extractionProgress}% complete
                        </div>
                      </div>
                    )}

                    {/* Status Messages - Only show during processing */}
                    {isProcessing && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="text-sm text-blue-800">
                          <div className="font-medium mb-1">{extractionPhase}</div>
                          <div className="text-xs text-blue-600">{extractionStatus}</div>
                          <div className="text-xs text-blue-500 mt-1">
                            Please wait while we process your documents...
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cost Estimate - Only show when not processing */}
                  {documents && documents.length > 0 && !isProcessing && !isExtractionComplete && (
                    <div className="mt-2 text-xs text-gray-500 text-center">
                      Estimated cost: {formatCost(estimateExtractionCost(
                        documents.length,
                        Math.max(20, documents.length * 15), // Estimate 15-20 items per document
                        documents.some(doc => doc.file_type?.startsWith('image/'))
                      ))}
                    </div>
                  )}

                  {/* Extraction Summary */}
                  {isExtractionComplete && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="text-sm text-green-800">
                        <div className="font-medium mb-1">✅ 3-Phase Extraction Complete</div>
                        <div className="text-xs text-green-600">
                          Extracted {extractionItemCount} menu items • Results displayed in table
                        </div>

                        {/* NEW: 3-Phase Cost Breakdown */}
                        {extractionResults?.data?.extractions && extractionResults.data.extractions.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {/* Show latest extraction with phase breakdown if available */}
                            {(() => {
                              const latestExtraction = extractionResults.data.extractions[0];
                              const hasPhaseBreakdown = latestExtractionData?.costBreakdown;

                              return (
                                <div className="space-y-1">
                                  <div className="text-xs text-green-600 flex justify-between items-center">
                                    <span>
                                      <span className="font-medium">Latest Extraction:</span>{' '}
                                      {latestExtractionData?.itemCount || latestExtraction.itemCount} items
                                      {(latestExtractionData?.apiCalls || latestExtraction.apiCallsCount) && (
                                        <span className="text-gray-500 ml-1">
                                          ({latestExtractionData?.apiCalls || latestExtraction.apiCallsCount} API calls)
                                        </span>
                                      )}
                                    </span>
                                    <span className={getCostColor(latestExtractionData?.totalCost || latestExtraction.extractionCost || 0)}>
                                      {formatCost(latestExtractionData?.totalCost || latestExtraction.extractionCost || 0)}
                                    </span>
                                  </div>

                                  {/* Phase breakdown with real costs */}
                                  <div className="text-xs text-green-500 mt-1 pl-2 border-l-2 border-green-300">
                                    {hasPhaseBreakdown ? (
                                      <div className="space-y-0.5">
                                        <div className="flex justify-between">
                                          <span>• Phase 1: Structure Analysis (Gemini Pro)</span>
                                          <span className="text-green-600 font-mono">
                                            {formatCost(latestExtractionData.costBreakdown.phase1)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>• Phase 2: Item Extraction (Flash Models)</span>
                                          <span className="text-green-600 font-mono">
                                            {formatCost(latestExtractionData.costBreakdown.phase2)}
                                          </span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span>• Phase 3: Modifier Enrichment (Gemini Pro)</span>
                                          <span className="text-green-600 font-mono">
                                            {formatCost(latestExtractionData.costBreakdown.phase3)}
                                          </span>
                                        </div>
                                        <div className="text-green-600 font-medium mt-1 pt-1 border-t border-green-300">
                                          Real token costs tracked (no estimates)
                                        </div>
                                      </div>
                                    ) : (
                                      <div>
                                        <div>• Phase 1: Structure Analysis (Gemini Pro)</div>
                                        <div>• Phase 2: Item Extraction (Flash Models)</div>
                                        <div>• Phase 3: Modifier Enrichment (Gemini Pro)</div>
                                        <div className="text-green-600 font-medium mt-1">
                                          Real token costs tracked (no estimates)
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Multiple extractions total */}
                            {extractionResults.data.extractions.length > 1 && (
                              <div className="text-xs text-green-700 font-medium border-t pt-1 flex justify-between">
                                <span>Total ({extractionResults.data.extractions.length} extractions):</span>
                                <span className={getCostColor(
                                  extractionResults.data.extractions.reduce((sum, ext) => sum + (ext.extractionCost || 0), 0)
                                )}>
                                  {formatCost(
                                    extractionResults.data.extractions.reduce((sum, ext) => sum + (ext.extractionCost || 0), 0)
                                  )}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                        {/* Temporary Debug Display */}
                        {items.length > 0 && process.env.NODE_ENV === 'development' && (
                          <details className="mt-2 text-xs">
                            <summary className="cursor-pointer text-gray-500">Debug: Categories</summary>
                            <div className="mt-1 p-2 bg-white rounded border text-xs">
                              <div><strong>Categories found:</strong> {[...new Set(items.map(item => item.subcategory))].join(', ')}</div>
                              <div><strong>Food tab items:</strong> {getItemsForTab('Food').length}</div>
                              <div><strong>N/A tab items:</strong> {getItemsForTab('N/A + Mocktails').length}</div>
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  )}

                  {/* File Previews */}
                  <FilePreviewPanel jobId={jobId} />
                </div>
              </ScrollArea>
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
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No team members available</p>
              ) : users.map((user) => {
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
    <div className="h-screen">
      <Suspense fallback={<LoadingWithTips />}>
        <JobPageContent />
      </Suspense>
    </div>
  );
}