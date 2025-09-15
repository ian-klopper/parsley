import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LogsPage from './page';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/lib/user-service';
import { ThemeProvider } from '@/components/ThemeProvider';

// Mock the modules
jest.mock('@/contexts/AuthContext');
jest.mock('@/lib/user-service');

const mockUseAuth = useAuth as jest.Mock;
const mockGetActivityLogs = UserService.getActivityLogs as jest.Mock;

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark">
      {ui}
    </ThemeProvider>
  );
};

describe('LogsPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock successful auth state
    mockUseAuth.mockReturnValue({
      userProfile: { id: 'admin-user', role: 'admin', full_name: 'Admin User', email: 'admin@test.com' },
      loading: false,
      isAdmin: true,
      hasAccess: true,
    });
  });

  it('renders the logs page title and loading state initially', () => {
    mockGetActivityLogs.mockReturnValue(new Promise(() => {})); // Keep it pending
    renderWithProviders(<LogsPage />);
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays the logs table after logs are loaded', async () => {
    mockGetActivityLogs.mockResolvedValue({
      logs: [
        { id: '1', action: 'User logged in', created_at: new Date().toISOString(), status: 'success', users: { full_name: 'Test User', email: 'test@example.com' } },
        { id: '2', action: 'Failed login attempt', created_at: new Date().toISOString(), status: 'error', users: { full_name: 'Another User', email: 'another@example.com' } },
      ],
      error: null,
    });

    renderWithProviders(<LogsPage />);

    await waitFor(() => {
      expect(screen.getByText('User logged in')).toBeInTheDocument();
      expect(screen.getByText('Failed login attempt')).toBeInTheDocument();
    });
  });

  it('displays an error message if loading logs fails', async () => {
    mockGetActivityLogs.mockResolvedValue({
      logs: null,
      error: 'Failed to fetch',
    });

    renderWithProviders(<LogsPage />);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    expect(screen.getByText('No activity logs found')).toBeInTheDocument();
  });
});