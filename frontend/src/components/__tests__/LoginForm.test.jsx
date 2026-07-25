import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '../LoginForm';
import toast from 'react-hot-toast';

// Mock react-router-dom's useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: null }),
}));

// Mock react-hot-toast
jest.mock('react-hot-toast');

// Mock fetch API
global.fetch = jest.fn();

// Helper function to render component with router
const renderWithRouter = (component) => {
  return render(<BrowserRouter>{component}</BrowserRouter>);
};

describe('LoginForm Component', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    global.fetch.mockClear();
    localStorage.clear();
  });

  // ========================================
  // 1. RENDERING TESTS
  // ========================================
  describe('Rendering', () => {
    test('renders login form with all essential elements', () => {
      renderWithRouter(<LoginForm />);

      // Check for input fields
      expect(screen.getByPlaceholderText(/Enter your User ID/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Enter your password/i)).toBeInTheDocument();

      // Check for submit button
      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();

      // Check for remember me checkbox
      expect(screen.getByLabelText(/Remember me/i)).toBeInTheDocument();
    });

    test('displays welcome message in login mode', () => {
      renderWithRouter(<LoginForm />);
      expect(screen.getByText(/Welcome back!/i)).toBeInTheDocument();
      expect(screen.getByText(/Sign in to continue to/i)).toBeInTheDocument();
    });

    test('renders password visibility toggle button', () => {
      renderWithRouter(<LoginForm />);
      const toggleButtons = screen.getAllByRole('button', { type: 'button' });
      expect(toggleButtons.length).toBeGreaterThan(0);
    });
  });

  // ========================================
  // 2. USER INTERACTION TESTS
  // ========================================
  describe('User Interactions', () => {
    test('allows user to type in username field', async () => {
      const user = userEvent.setup();
      renderWithRouter(<LoginForm />);

      const usernameInput = screen.getByPlaceholderText(/Enter your User ID/i);
      await user.type(usernameInput, 'testuser123');

      expect(usernameInput).toHaveValue('testuser123');
    });

    test('allows user to type in password field', async () => {
      const user = userEvent.setup();
      renderWithRouter(<LoginForm />);

      const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
      await user.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });

    test('toggles password visibility when eye icon is clicked', async () => {
      renderWithRouter(<LoginForm />);

      const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
      expect(passwordInput).toHaveAttribute('type', 'password');

      // Find and click the toggle button (within the password field area)
      const toggleButtons = screen.getAllByRole('button');
      const eyeToggle = toggleButtons.find(btn => btn.type === 'button');

      fireEvent.click(eyeToggle);
      expect(passwordInput).toHaveAttribute('type', 'text');

      fireEvent.click(eyeToggle);
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('toggles remember me checkbox', async () => {
      const user = userEvent.setup();
      renderWithRouter(<LoginForm />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });
  });

  // ========================================
  // 3. FORM VALIDATION TESTS
  // ========================================
  describe('Form Validation', () => {
    test('shows error when submitting with empty username', async () => {
      const user = userEvent.setup();
      renderWithRouter(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /Sign In/i });
      await user.click(submitButton);

      expect(await screen.findByText(/User ID is required/i)).toBeInTheDocument();
    });

    test('shows error when submitting with empty password', async () => {
      const user = userEvent.setup();
      renderWithRouter(<LoginForm />);

      const usernameInput = screen.getByPlaceholderText(/Enter your User ID/i);
      await user.type(usernameInput, 'testuser');

      const submitButton = screen.getByRole('button', { name: /Sign In/i });
      await user.click(submitButton);

      expect(await screen.findByText(/Password is required/i)).toBeInTheDocument();
    });

    test('shows error when password is less than 6 characters', async () => {
      const user = userEvent.setup();
      renderWithRouter(<LoginForm />);

      const usernameInput = screen.getByPlaceholderText(/Enter your User ID/i);
      const passwordInput = screen.getByPlaceholderText(/Enter your password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, '12345'); // Less than 6 characters

      const submitButton = screen.getByRole('button', { name: /Sign In/i });
      await user.click(submitButton);

      expect(await screen.findByText(/Password must be at least 6 characters/i)).toBeInTheDocument();
    });

    test('clears error messages when user starts typing', async () => {
      const user = userEvent.setup();
      renderWithRouter(<LoginForm />);

      // Trigger validation error
      const submitButton = screen.getByRole('button', { name: /Sign In/i });
      await user.click(submitButton);

      expect(await screen.findByText(/User ID is required/i)).toBeInTheDocument();

      // Start typing to clear error
      const usernameInput = screen.getByPlaceholderText(/Enter your User ID/i);
      await user.type(usernameInput, 't');

      expect(screen.queryByText(/User ID is required/i)).not.toBeInTheDocument();
    });
  });

  // ========================================
  // 4. API CALL & LOGIN TESTS
  // ========================================
  describe('Login API Integration', () => {
    test('successfully logs in and navigates to dashboard', async () => {
      const user = userEvent.setup();

      // Mock successful login response
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'fake-jwt-token',
          userType: 'Student',
        }),
      });

      renderWithRouter(<LoginForm />);

      // Fill in form
      const usernameInput = screen.getByPlaceholderText(/Enter your User ID/i);
      const passwordInput = screen.getByPlaceholderText(/Enter your password/i);

      await user.type(usernameInput, 'testuser');
      await user.type(passwordInput, 'password123');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Sign In/i });
      await user.click(submitButton);

      // Wait for async operations
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/auth/login'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              username: 'testuser',
              password: 'password123',
              rememberMe: false,
            }),
          })
        );
      });

      // Check localStorage was updated
      expect(localStorage.getItem('token')).toBe('fake-jwt-token');
      expect(localStorage.getItem('userType')).toBe('Student');

      // Check navigation happened
      expect(mockNavigate).toHaveBeenCalledWith('/student');

      // Check success toast
      expect(toast.success).toHaveBeenCalledWith('Login successful');
    });

    test('shows error message on failed login', async () => {
      const user = userEvent.setup();

      // Mock failed login response
      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: 'Invalid credentials',
        }),
      });

      renderWithRouter(<LoginForm />);

      // Fill in form
      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'testuser');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'wrongpassword');

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Sign In/i });
      await user.click(submitButton);

      // Wait for error message
      expect(await screen.findByText(/Invalid credentials/i)).toBeInTheDocument();
    });

    test('clears login error after user edits a field', async () => {
      const user = userEvent.setup();

      global.fetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      });

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'testuser');
      const passwordInput = screen.getByPlaceholderText(/Enter your password/i);
      await user.type(passwordInput, 'wrongpassword');

      await user.click(screen.getByRole('button', { name: /Sign In/i }));
      expect(await screen.findByText(/Invalid credentials/i)).toBeInTheDocument();

      await user.type(passwordInput, '!');

      await waitFor(() => {
        expect(screen.queryByText(/Invalid credentials/i)).not.toBeInTheDocument();
      });
    });

    test('shows loading state during login', async () => {
      const user = userEvent.setup();

      // Mock a delayed response
      global.fetch.mockImplementationOnce(
        () => new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: async () => ({ token: 'token', userType: 'Student' }),
        }), 100))
      );

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'testuser');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'password123');

      const submitButton = screen.getByRole('button', { name: /Sign In/i });
      await user.click(submitButton);

      // Check for loading state
      expect(await screen.findByText(/Signing in.../i)).toBeInTheDocument();
      expect(submitButton).toBeDisabled();
    });

    test('trims whitespace from username before sending login request', async () => {
      const user = userEvent.setup();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'token', userType: 'Student' }),
      });

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), '  spaceduser  ');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.username).toBe('spaceduser');
      expect(requestBody.rememberMe).toBe(false);
    });

    test('navigates to Teacher dashboard for Teacher user', async () => {
      const user = userEvent.setup();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'token', userType: 'Teacher' }),
      });

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'teacher');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/teacher/dashboard');
      });
    });

    test('navigates to Admin dashboard for Admin user', async () => {
      const user = userEvent.setup();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'token', userType: 'Admin' }),
      });

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'admin');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
      });
    });
  });

  // ========================================
  // 5. PASSWORD RESET MODE TESTS
  // ========================================
  describe('Password Reset Mode', () => {
    test('switches to reset mode when requiresPasswordReset is true', async () => {
      const user = userEvent.setup();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresPasswordReset: true,
          userType: 'Student',
          username: 'testuser',
        }),
      });

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'testuser');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      // Wait for reset mode UI
      expect(await screen.findByRole('heading', { name: /Reset your password/i })).toBeInTheDocument();
      expect(await screen.findByText(/First login detected/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Create a strong password/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Re-enter your password/i)).toBeInTheDocument();
    });

    test('completes password reset flow for student and logs in automatically', async () => {
      const user = userEvent.setup();

      global.fetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            requiresPasswordReset: true,
            userType: 'Student',
            username: 'student01',
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: 'reset-token', userType: 'Student' }),
        });

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'student01');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      expect(await screen.findByRole('heading', { name: /Reset your password/i })).toBeInTheDocument();

      const newPasswordInput = screen.getByPlaceholderText(/Create a strong password/i);
      const confirmPasswordInput = screen.getByPlaceholderText(/Re-enter your password/i);

      await user.type(newPasswordInput, 'StrongPass1!');
      await user.type(confirmPasswordInput, 'StrongPass1!');

      await user.click(screen.getByRole('button', { name: /Reset & Sign In/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      expect(global.fetch).toHaveBeenNthCalledWith(
        2,
        'http://localhost:5000/api/student/auth/reset-first-password',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'student01',
            newPassword: 'StrongPass1!',
          }),
        })
      );

      expect(global.fetch).toHaveBeenNthCalledWith(
        3,
        'http://localhost:5000/api/student/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            username: 'student01',
            password: 'StrongPass1!',
          }),
        })
      );

      expect(localStorage.getItem('token')).toBe('reset-token');
      expect(localStorage.getItem('userType')).toBe('Student');
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
      expect(toast.success).toHaveBeenCalledWith('Login successful');
    });

    test('shows error when reset user type is not supported', async () => {
      const user = userEvent.setup();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          requiresPasswordReset: true,
          userType: 'Guest',
          username: 'guestuser',
        }),
      });

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'guestuser');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      expect(await screen.findByRole('heading', { name: /Reset your password/i })).toBeInTheDocument();

      await user.type(screen.getByPlaceholderText(/Create a strong password/i), 'StrongPass1!');
      await user.type(screen.getByPlaceholderText(/Re-enter your password/i), 'StrongPass1!');

      await user.click(screen.getByRole('button', { name: /Reset & Sign In/i }));

      expect(await screen.findByText(/Unsupported password reset flow/i)).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ========================================
  // 6. REMEMBER ME FUNCTIONALITY
  // ========================================
  describe('Remember Me', () => {
    test('sends rememberMe flag when checkbox is checked', async () => {
      const user = userEvent.setup();

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: 'token', userType: 'Student' }),
      });

      renderWithRouter(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/Enter your User ID/i), 'testuser');
      await user.type(screen.getByPlaceholderText(/Enter your password/i), 'password123');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            body: JSON.stringify({
              username: 'testuser',
              password: 'password123',
              rememberMe: true,
            }),
          })
        );
      });
    });
  });
});
