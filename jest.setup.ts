import '@testing-library/jest-dom'
import React from 'react'

// Global Response and Request mocks for Node.js environment
global.Response = class Response {
  status: number
  statusText: string
  headers: Map<string, string>
  body: any

  constructor(body: any, init?: { status?: number; statusText?: string; headers?: Record<string, string> }) {
    this.body = body
    this.status = init?.status || 200
    this.statusText = init?.statusText || 'OK'
    this.headers = new Map(Object.entries(init?.headers || {}))
  }

  json() { return Promise.resolve(JSON.parse(this.body)) }
  text() { return Promise.resolve(this.body) }
} as any

global.Request = class Request {
  url: string
  method: string
  headers: Map<string, string>
  body: any

  constructor(url: string, init?: { method?: string; headers?: Record<string, string>; body?: any }) {
    this.url = url
    this.method = init?.method || 'GET'
    this.headers = new Map(Object.entries(init?.headers || {}))
    this.body = init?.body
  }

  json() { return Promise.resolve(this.body ? JSON.parse(this.body) : {}) }
} as any

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/',
}));

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'dark',
    setTheme: jest.fn(),
  }),
  ThemeProvider: ({ children }: any) => children,
}));

// Mock useToast hook
jest.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

// Mock ColorPicker component
jest.mock('@/components/ui/color-picker', () => ({
  ColorPicker: ({ trigger }: any) => trigger || 'Color Picker',
}));

// Mock AccessControl component
jest.mock('@/components/AccessControl', () => ({
  AccessControl: ({ children }: any) => children,
}));

// Mock all UI components that might cause issues
jest.mock('@/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children }: any) => React.createElement('div', { 'data-testid': 'resizable-panel-group' }, children),
  ResizablePanel: ({ children }: any) => React.createElement('div', { 'data-testid': 'resizable-panel' }, children),
  ResizableHandle: () => React.createElement('div', { 'data-testid': 'resizable-handle' }),
}));
