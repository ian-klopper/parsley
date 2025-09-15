'use client'

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sun, Moon, LogOut, UserCog, FileText, LayoutDashboard, Briefcase, Users } from "lucide-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/AuthContext"
import { getUserColor } from "@/lib/theme-utils"
import { UserService } from "@/lib/user-service"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"

export function UserNavigation() {
  const { theme, setTheme } = useTheme()
  const { userProfile } = useAuth()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = () => {
    router.push('/')
  }

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Avatar className="cursor-pointer hover:ring-2 hover:ring-primary hover:ring-offset-2 transition-all">
            <AvatarFallback style={getUserColor(userProfile, theme, mounted)} suppressHydrationWarning>
              {userProfile?.initials || UserService.generateInitials(userProfile?.full_name) || 'U'}
            </AvatarFallback>
          </Avatar>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex items-center justify-start gap-2 p-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback style={getUserColor(userProfile, theme, mounted)} suppressHydrationWarning>
                {userProfile?.initials || UserService.generateInitials(userProfile?.full_name) || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{userProfile?.full_name || 'User'}</p>
              <p className="text-xs leading-none text-muted-foreground">{userProfile?.email}</p>
            </div>
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => router.push('/dashboard')}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => router.push('/job')}>
            <Briefcase className="mr-2 h-4 w-4" />
            <span>Jobs</span>
          </DropdownMenuItem>

          {userProfile?.role === 'admin' && (
            <DropdownMenuItem onClick={() => router.push('/admin')}>
              <UserCog className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
          )}

          {userProfile?.role === 'pending' && (
            <DropdownMenuItem onClick={() => router.push('/pending')}>
              <Users className="mr-2 h-4 w-4" />
              <span>Pending Approval</span>
            </DropdownMenuItem>
          )}

          <DropdownMenuItem onClick={() => router.push('/logs')}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Activity Logs</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            <span>Toggle Theme</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Sign Out</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  )
}