
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
import { Button } from "@/components/ui/button"
import { ArrowLeft, PlusCircle, LogOut, UserCog, FileText, Users, Crown, Upload, Play } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { colorSpectrum } from "@/lib/colors"
import { jobs } from "@/lib/jobs-data"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { users } from "@/lib/users-data"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useState } from "react";
import { allItems, FoodItem } from "@/lib/food-data";
import { tabCategories } from "@/lib/menu-data";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ItemTable } from "@/components/ItemTable";
import { Table, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"


const getStatusBadgeVariant = (status: (typeof jobs)[number]["status"]) => {
  switch (status) {
    case "Live":
      return "default";
    case "Processing":
      return "default";
    case "Error":
      return "destructive";
    case "Complete":
      return "secondary";
    default:
      return "secondary";
  }
}

const getStatusBadgeStyle = (status: (typeof jobs)[number]["status"]) => {
  if (status === "Complete") {
    return { backgroundColor: "hsl(140, 80%, 40%)", color: "white" };
  }
  if (status === "Processing") {
    return { backgroundColor: "hsl(202.5, 100%, 40%)", color: "white" };
  }
  return {};
}

const collaboratorNames = [
  ...new Set(jobs.flatMap((job) => job.collaborators.map((c) => c.name))),
];

const collaboratorColors: { [name: string]: string } = {};
collaboratorNames.forEach((name, i) => {
  collaboratorColors[name] = colorSpectrum[i * 2 % colorSpectrum.length];
});

const userNames = [
  ...new Set(users.map((user) => user.name)),
];

const userColors: { [name: string]: string } = {};
userNames.forEach((name, i) => {
  const hash = name.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  userColors[name] = colorSpectrum[Math.abs(hash) % colorSpectrum.length];
});

export default function JobPage() {
  const job = jobs[0];
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
  
  const [items, setItems] = useState<FoodItem[]>(allItems);
  const [extractionStarted, setExtractionStarted] = useState(false);

  const getItemsForTab = (tab: string) => {
    const categories = tabCategories[tab];
    if (!categories) return [];
    return items.filter(item => categories.includes(item.subcategory));
  };

  const handleItemsChange = (updatedItems: FoodItem[], tab: string) => {
    const categories = tabCategories[tab];
    const otherItems = items.filter(item => !categories.includes(item.subcategory));
    setItems([...otherItems, ...updatedItems]);
  };


  return (
    <main className="h-screen">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full"
      >
        <ResizablePanel defaultSize={75}>
          <div className="flex flex-col h-full">
            <div className="p-6 pb-0 flex-shrink-0">
              <div className="flex items-center gap-4">
                <Link href="/jobs">
                  <ArrowLeft />
                </Link>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">{job.venue}</h1>
                    <Badge variant={getStatusBadgeVariant(job.status)} style={getStatusBadgeStyle(job.status)}>{job.status}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-sm text-muted-foreground">{job.id}</p>
                    <div className="flex items-center gap-2">
                      {job.collaborators.map(c => (
                        <Badge key={c.name} variant="secondary" className="whitespace-nowrap" style={{ backgroundColor: collaboratorColors[c.name], color: "white" }}>{c.name}</Badge>
                      ))}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Users className="h-5 w-5 text-muted-foreground cursor-pointer" />
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Collaborators</DialogTitle>
                          </DialogHeader>
                          <div className="flex flex-col gap-4">
                            {users.map((user) => (
                              <div key={user.email} className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <Avatar>
                                    <AvatarFallback style={{ backgroundColor: userColors[user.name], color: "white" }}>
                                      {user.initials}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="font-medium">{user.name}</p>
                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <Switch />
                                  <Crown className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </div>

              {extractionStarted && (
                <Tabs defaultValue={tabs[0]} className="w-full mt-4">
                  <TabsList className="bg-transparent p-0 px-6">
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
                          <div className="flex flex-1 items-center justify-center w-full rounded-lg border border-dashed mt-4 p-8">
                            <p className="text-muted-foreground">Menu Structure details will go here.</p>
                          </div>
                        </TabsContent>
                        <TabsContent value="Modifiers">
                          <div className="flex flex-1 items-center justify-center w-full rounded-lg border border-dashed mt-4 p-8">
                            <p className="text-muted-foreground">Modifiers details will go here.</p>
                          </div>
                        </TabsContent>
                    </Tabs>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-1 items-center justify-center w-full h-full">
                  <p className="text-muted-foreground">
                    Click &quot;Start Extraction&quot; to begin.
                  </p>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={25} className="bg-secondary">
          <div className="flex flex-col items-end p-6 gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Avatar>
                  <AvatarFallback style={{ backgroundColor: colorSpectrum[10], color: "white" }}>IK</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <LogOut />
                  Logout
                </DropdownMenuItem>
                <Link href="/admin">
                  <DropdownMenuItem>
                    <UserCog />
                    Admin
                  </DropdownMenuItem>
                </Link>
                <Link href="/logs">
                  <DropdownMenuItem>
                    <FileText />
                    Logs
                  </DropdownMenuItem>
                </Link>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-full flex flex-col gap-4">
              <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-700">
                  <Upload className="h-8 w-8 text-zinc-500" />
                  <p className="text-sm text-zinc-500 mt-2">
                    Upload PDF, spreadsheet, or images
                  </p>
                  <input type="file" className="hidden" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" multiple />
              </div>
              <Button className="w-full" onClick={() => setExtractionStarted(true)}>
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
