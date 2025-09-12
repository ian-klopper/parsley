
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
import { ArrowLeft, PlusCircle, LogOut, UserCog, FileText, Upload, Crown } from "lucide-react"
import { jobs } from "@/lib/jobs-data"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { colorSpectrum } from "@/lib/colors"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { users } from "@/lib/users-data"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

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

export default function Home() {
  return (
    <main className="h-screen">
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
                <h1 className="text-2xl font-bold">Jobs</h1>
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
                      <TableRow key={job.id} className="border-b-0 hover:bg-transparent">
                        <TableCell>
                          <Link href={`/job`}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{job.venue}</span>
                              <Badge variant={getStatusBadgeVariant(job.status)} style={getStatusBadgeStyle(job.status)}>{job.status}</Badge>
                            </div>
                            <div className="text-sm text-muted-foreground">{job.id}</div>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            {job.collaborators.map(c => (
                              <Badge key={c.name} variant="secondary" className="whitespace-nowrap" style={{ backgroundColor: collaboratorColors[c.name], color: "white" }}>{c.name}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>{job.createdBy}</TableCell>
                        <TableCell>{job.lastActivity}</TableCell>
                        <TableCell>...</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </ScrollArea>
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
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="w-full">
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
                      <Label htmlFor="job-name">Name</Label>
                      <Input id="job-name" placeholder="Enter job name" />
                    </div>
                    <div>
                      <Label htmlFor="job-id">ID</Label>
                      <Input id="job-id" placeholder="Enter job ID" />
                    </div>
                    <div>
                      <Label>Add Collaborators</Label>
                      <div className="flex flex-col gap-4 mt-2">
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
                              <Crown className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:bg-zinc-700">
                      <Upload className="h-8 w-8 text-zinc-500" />
                      <p className="text-sm text-zinc-500 mt-2">
                        Upload PDF, spreadsheet, or images
                      </p>
                      <input type="file" className="hidden" accept=".pdf,.csv,.xlsx,.xls,.png,.jpg,.jpeg" multiple />
                    </div>
                    <Link href="/job" className="w-full">
                      <Button className="w-full">
                        Create Job
                      </Button>
                    </Link>
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
