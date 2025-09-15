'use client'

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { LogOut, UserCog, FileText, Sun, Moon, LayoutDashboard } from "lucide-react"
import Link from "next/link"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/AuthContext"
import { UserService } from "@/lib/user-service"
import { getUserColor } from "@/lib/theme-utils"
import { useState, useEffect } from "react"

export function NavigationPanel() {
  const { theme, setTheme } = useTheme()
  const { userProfile, signOut } = useAuth()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      // Error is already handled in AuthContext
    }
  }

  return (
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
            <span>Toggle Theme</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            <span>Logout</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.location.href = '/dashboard'}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
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
    </div>
  )
}