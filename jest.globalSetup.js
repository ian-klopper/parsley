jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: () => {
    const dynamic = jest.fn()
    return dynamic
  },
}));