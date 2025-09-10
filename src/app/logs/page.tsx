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
import { logs } from "@/lib/logs-data"
import { Badge } from "@/components/ui/badge"
import { users } from "@/lib/users-data"

const allUserNames = [
  ...new Set(users.map((user) => user.name)),
  ...new Set(logs.map((log) => log.user.name)),
];


const userColors: { [name: string]: string } = {};
allUserNames.forEach((name, i) => {
  const hash = name.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  userColors[name] = colorSpectrum[Math.abs(hash) % colorSpectrum.length];
});

const getStatusBadgeVariant = (status: (typeof logs)[number]["status"]) => {
  switch (status) {
    case "Success":
      return "secondary";
    case "Failure":
      return "destructive";
    default:
      return "default";
  }
}

const getStatusBadgeStyle = (status: (typeof logs)[number]["status"]) => {
  if (status === "Success") {
    return { backgroundColor: "hsl(140, 80%, 40%)", color: "white" };
  }
  return {};
}

const renderAction = (action: string) => {
  let renderedAction: (string | JSX.Element)[] = [action];
  
  users.forEach(user => {
    if (action.includes(user.name)) {
      const newRenderedAction: (string | JSX.Element)[] = [];
      renderedAction.forEach(part => {
        if (typeof part === 'string') {
          const splitParts = part.split(user.name);
          splitParts.forEach((splitPart, index) => {
            newRenderedAction.push(splitPart);
            if (index < splitParts.length - 1) {
              newRenderedAction.push(
                <Badge
                  key={`${user.name}-${index}`}
                  variant="secondary"
                  className="whitespace-nowrap mx-1"
                  style={{ backgroundColor: userColors[user.name], color: "white" }}
                >
                  {user.name}
                </Badge>
              );
            }
          });
        } else {
          newRenderedAction.push(part);
        }
      });
      renderedAction = newRenderedAction;
    }
  });

  return <p>{renderedAction}</p>;
};

export default function LogsPage() {
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
              <h1 className="text-2xl font-bold">Logs</h1>
            </div>
            <div className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id} className="border-b-0 hover:bg-transparent">
                      <TableCell>
                        <Avatar>
                          <AvatarFallback style={{ backgroundColor: userColors[log.user.name], color: "white" }}>
                            {log.user.initials}
                          </AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell>{renderAction(log.action)}</TableCell>
                      <TableCell>{log.timestamp}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(log.status)} style={getStatusBadgeStyle(log.status)}>
                          {log.status}
                        </Badge>
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
                  <AvatarFallback style={{ backgroundColor: userColors['Ishanika'], color: "white" }}>IK</AvatarFallback>
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
