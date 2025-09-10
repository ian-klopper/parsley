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
import { ArrowLeft, PlusCircle, LogOut, UserCog, FileText } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { colorSpectrum } from "@/lib/colors"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { users } from "@/lib/users-data"

const userNames = [
  ...new Set(users.map((user) => user.name)),
];

const userColors: { [name: string]: string } = {};
userNames.forEach((name, i) => {
  userColors[name] = colorSpectrum[i % colorSpectrum.length];
});


export default function AdminPage() {
  return (
    <main className="h-screen">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full"
      >
        <ResizablePanel defaultSize={75}>
          <div className="flex flex-col h-full items-start justify-start p-6 gap-4">
            <div className="flex items-center gap-4">
              <Link href="/jobs">
                <ArrowLeft />
              </Link>
              <h1 className="text-2xl font-bold">Admin</h1>
            </div>
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.email} className="border-b-0 hover:bg-transparent">
                      <TableCell>
                        <Avatar>
                          <AvatarFallback style={{ backgroundColor: userColors[user.name], color: "white" }}>
                            {user.initials}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Select defaultValue={user.role}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Select a role" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Admin">Admin</SelectItem>
                            <SelectItem value="Manager">Manager</SelectItem>
                            <SelectItem value="Collaborator">Collaborator</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
            <Link href="/job" className="w-full">
              <Button className="w-full">
                <PlusCircle />
                New Job
              </Button>
            </Link>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
