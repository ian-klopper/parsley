// Mock for Next.js 13+ navigation hooks
const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
  prefetch: jest.fn()
}

const mockSearchParams = new URLSearchParams()

const mockPathname = '/test'

module.exports = {
  useRouter: () => mockRouter,
  useSearchParams: () => mockSearchParams,
  usePathname: () => mockPathname,
  useParams: () => ({}),
  // Export the mocks for test access
  __mockRouter: mockRouter,
  __mockSearchParams: mockSearchParams
}