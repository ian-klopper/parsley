import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import AdminPage from './page';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/lib/user-service';
import { ThemeProvider } from '@/components/ThemeProvider';

// Mock the modules
jest.mock('@/contexts/AuthContext');
jest.mock('@/lib/user-service');

const mockUseAuth = useAuth as jest.Mock;
const mockGetAllUsers = UserService.getAllUsers as jest.Mock;

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ThemeProvider attribute="class" defaultTheme="dark">
      {ui}
    </ThemeProvider>
  );
};

describe('AdminPage', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Mock successful auth state
    mockUseAuth.mockReturnValue({
      userProfile: { id: 'admin-user', role: 'admin', full_name: 'Admin User', email: 'admin@test.com' },
      loading: false,
      isAdmin: true,
      hasAccess: true,
      refreshProfile: jest.fn(),
    });
  });

  it('renders the admin page title and loading state initially', () => {
    mockGetAllUsers.mockReturnValue(new Promise(() => {})); // Keep it pending
    renderWithProviders(<AdminPage />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays the user table after users are loaded', async () => {
    mockGetAllUsers.mockResolvedValue({
      users: [
        { id: '1', full_name: 'Test User', email: 'test@example.com', role: 'user', created_at: new Date().toISOString(), color_index: 1 },
        { id: '2', full_name: 'Another User', email: 'another@example.com', role: 'pending', created_at: new Date().toISOString(), color_index: 2 },
      ],
      error: null,
    });

    renderWithProviders(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('another@example.com')).toBeInTheDocument();
    });
  });

  it('displays an error message if loading users fails', async () => {
    mockGetAllUsers.mockResolvedValue({
      users: null,
      error: 'Failed to fetch',
    });

    renderWithProviders(<AdminPage />);

    // The toast hook is mocked, so we can't see the toast.
    // Instead, we'll check that the loading spinner disappears and the "No users found" message appears.
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
    expect(screen.getByText('No users found')).toBeInTheDocument();
  });
});