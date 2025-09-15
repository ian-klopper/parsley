'use client'

import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { NavigationPanel } from "@/components/NavigationPanel"
import { BackButton } from "@/components/BackButton"
import { UserNavigation } from "@/components/UserNavigation"

interface PageLayoutProps {
  title: string
  children: React.ReactNode
  showBackButton?: boolean
  rightPanelContent?: React.ReactNode
}

export function PageLayout({
  title,
  children,
  showBackButton = true,
  rightPanelContent
}: PageLayoutProps) {
  return (
    <main className="h-screen bg-background">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full"
      >
        <ResizablePanel defaultSize={75}>
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-4 p-6 pb-0">
              {showBackButton && <BackButton />}
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            </div>
            <div className="flex-1 p-6 pt-4 overflow-auto">
              {children}
            </div>
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle={false} />
        <ResizablePanel defaultSize={25} className="bg-secondary">
          <div className="flex flex-col h-full">
            <div className="flex justify-end p-4">
              <UserNavigation />
            </div>
            <div className="flex-1 overflow-auto">
              {rightPanelContent || <NavigationPanel />}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  )
}