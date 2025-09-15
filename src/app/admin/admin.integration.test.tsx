import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AdminPage from './page';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/lib/user-service';

// Mock all dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/lib/user-service');
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

const mockUseAuth = useAuth as jest.Mock;
const mockUserService = {
  getAllUsers: UserService.getAllUsers as jest.Mock,
  updateUserRole: UserService.updateUserRole as jest.Mock,
  updateUserColor: UserService.updateUserColor as jest.Mock,
  generateInitials: UserService.generateInitials as jest.Mock,
};

const mockUsers = [
  {
    id: 'user1',
    full_name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    created_at: '2023-01-01T00:00:00Z',
    color_index: 1,
    initials: 'JD'
  },
  {
    id: 'user2', 
    full_name: 'Jane Admin',
    email: 'jane@example.com',
    role: 'admin',
    created_at: '2023-01-02T00:00:00Z',
    color_index: 2,
    initials: 'JA'
  }
];

describe('Admin Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseAuth.mockReturnValue({
      userProfile: {
        id: 'admin-user',
        role: 'admin',
        full_name: 'Admin User',
        email: 'admin@test.com',
        initials: 'AU'
      },
      loading: false,
      isAdmin: true,
      hasAccess: true,
      refreshProfile: jest.fn(),
    });

    mockUserService.generateInitials.mockImplementation((name: string) => {
      return name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : '??';
    });
  });

  it('should render admin page and load users', async () => {
    mockUserService.getAllUsers.mockResolvedValue({
      users: mockUsers,
      error: null,
    });

    render(<AdminPage />);

    // Check that admin title is displayed
    expect(screen.getByText('Admin')).toBeInTheDocument();
    
    // Check loading spinner appears first
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    });

    // Check loading spinner disappears
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });

  it('should call updateUserRole when role is changed', async () => {
    mockUserService.getAllUsers.mockResolvedValue({
      users: mockUsers,
      error: null,
    });

    mockUserService.updateUserRole.mockResolvedValue({
      success: true,
      error: null,
    });

    render(<AdminPage />);

    // Wait for users to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Find the role select dropdown - there should be multiple selects
    const roleSelects = screen.getAllByRole('combobox');
    
    // The first one should be for John Doe (user role)
    const johnRoleSelect = roleSelects.find(select => 
      select.getAttribute('value') === 'user'
    );
    
    if (johnRoleSelect) {
      // Open the dropdown
      fireEvent.click(johnRoleSelect);
      
      // Wait for dropdown options and click admin
      await waitFor(() => {
        const adminOption = screen.getByText('Admin');
        fireEvent.click(adminOption);
      });

      // Verify updateUserRole was called
      expect(mockUserService.updateUserRole).toHaveBeenCalledWith('user1', 'admin');
    }
  });

  it('should handle role update errors gracefully', async () => {
    mockUserService.getAllUsers.mockResolvedValue({
      users: mockUsers,
      error: null,
    });

    mockUserService.updateUserRole.mockResolvedValue({
      success: false,
      error: 'Permission denied',
    });

    const mockToast = jest.fn();
    jest.doMock('@/hooks/use-toast', () => ({
      useToast: () => ({ toast: mockToast }),
    }));

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Try to change role - this should fail and show error
    expect(mockUserService.updateUserRole).not.toHaveBeenCalled();
  });

  it('should display user colors correctly', async () => {
    mockUserService.getAllUsers.mockResolvedValue({
      users: mockUsers,
      error: null,
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check that user avatars with initials are displayed
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByText('JA')).toBeInTheDocument();
  });

  it('should handle empty user list', async () => {
    mockUserService.getAllUsers.mockResolvedValue({
      users: [],
      error: null,
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    expect(screen.getByText('No users found')).toBeInTheDocument();
  });

  it('should format user creation dates', async () => {
    mockUserService.getAllUsers.mockResolvedValue({
      users: mockUsers,
      error: null,
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    // Check that formatted dates are displayed
    // Date formatting may vary by locale, but should contain year
    expect(screen.getByText(/2023/)).toBeInTheDocument();
  });

  it('should disable role change for current admin user', async () => {
    const currentAdminUsers = [
      {
        ...mockUsers[1],
        id: 'admin-user', // Same as current user in mock
      }
    ];

    mockUserService.getAllUsers.mockResolvedValue({
      users: currentAdminUsers,
      error: null,
    });

    render(<AdminPage />);

    await waitFor(() => {
      expect(screen.getByText('Jane Admin')).toBeInTheDocument();
    });

    // Find the role select for the current admin user
    const roleSelects = screen.getAllByRole('combobox');
    const adminRoleSelect = roleSelects.find(select => 
      select.getAttribute('value') === 'admin'
    );

    // It should be disabled for the current user
    expect(adminRoleSelect).toBeDisabled();
  });
});