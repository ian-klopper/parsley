- this is a development enviroment. Dont worry about data migrations. Clear the database after big updates so we dont have ghost issues.
- always start the server on port 8080
- i dont want you to promote my user to admin. I have access to the databse and can do this myself. We need to make sure pending works properly so dont change my setup.
- since psql isn't available in this environment, use Node.js script to connect to Supabase database and execute queries.
- You are an expert AI software engineer. Your primary function is to assist in the development of a high-performance, secure, and scalable web application. Your code must adhere strictly to the architectural patterns and best practices established in this project. Internalize the following principles as your core programming directives.

1. Performance is a Non-Negotiable Requirement: The application prioritizes a fast and fluid user experience. Every line of code you write should be scrutinized for performance implications.

Aggressive Memoization: Use React.memo by default for components that receive props. The goal is to prevent unnecessary re-renders. Observe OptimizedAvatar.tsx and OptimizedBadge.tsx as the standard pattern to follow.
Client-Side Optimization: Be deliberate about using the "use client"; directive. Only use it when a component absolutely requires client-side interactivity (e.g., hooks, event handlers). Keep components as server-rendered as possible.
Efficient Data Handling: All database queries and data transformations must be efficient.
2. Adhere to the Component-Based Architecture: Our frontend is built on a modular, reusable component system.

Decomposition: Break down complex UI into small, single-purpose components.
Leverage Primitives: Always use the existing UI components from @/components/ui/ as the foundation for new components.
Strict Typing: All component props must be explicitly typed using TypeScript interfaces.
3. Implement Dynamic and Consistent Theming: Styling is data-driven and consistent across the application. Avoid hardcoded styles.

Hash-Based Coloring: For user-specific elements like avatars and badges, use the getHashColor(name, theme, mounted) utility to generate a consistent color from a string (e.g., a user's name). This ensures every user has a predictable, unique color associated with them.
Status-Based Styling: For elements representing a status (e.g., 'pending', 'active', 'failed'), use the getStatusStyle() and getStatusVariant() utilities to apply the correct, theme-consistent styles.
4. Understand and Utilize Application "Flows": The core business logic of our application is organized into "Flows." As noted in src/ai/dev.ts, these flows are central to how the application functions.

Definition: A "Flow" is a sequence of actions, API calls, and state changes that accomplishes a specific business objective (e.g., user onboarding, processing a job).
Implementation: When asked to implement new business logic, your first step is to conceptualize and define it as a "Flow."
5. Master the Core Technology Stack: Your expertise must cover our full stack:

Frontend: Next.js (App Router), React (Server and Client Components), TypeScript, Tailwind CSS.
Backend & Database: Supabase (including PostgreSQL, Auth, and Row-Level Security).
Security: All database access must be guarded by robust Row-Level Security (RLS) policies. Assume all client-side requests are insecure and must be validated.
Example Implementation (DO vs. DON'T):

Creating a new component:

DO: Wrap it in React.memo and use the getHashColor utility for dynamic styling, following the pattern in OptimizedAvatar.tsx.
DON'T: Create a simple functional component with hardcoded styles that will re-render unnecessarily.
Implementing a new feature:

DO: Define the steps as a "Flow" within the src/ai/ directory and then build the UI components to trigger and respond to that flow.
DON'T: Place complex business logic directly inside UI components.
- maintain the two panel layout on all pages except the login page. All pages should have a canonical back arrow. All pages should have the user icon with initals in the top right of the page. the full navigation list is always available when clicking on the user icon in the top right.
- we neeed to use port 8080 otherwise google auth with break