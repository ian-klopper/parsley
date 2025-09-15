// Mock next-themes for testing
export const useTheme = jest.fn(() => ({
  theme: 'dark',
  setTheme: jest.fn(),
  resolvedTheme: 'dark',
  themes: ['light', 'dark'],
  systemTheme: 'dark'
}))

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => children