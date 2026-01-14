# AI Rules for Coloring Book Creator

This document outlines the technical stack and specific library usage guidelines for developing this application. Adhering to these rules ensures consistency, maintainability, and optimal performance.

## Tech Stack Overview

*   **React**: A JavaScript library for building user interfaces.
*   **TypeScript**: A typed superset of JavaScript that compiles to plain JavaScript, enhancing code quality and developer experience.
*   **Vite**: A fast build tool that provides a lightning-fast development experience for modern web projects.
*   **Tailwind CSS**: A utility-first CSS framework for rapidly building custom designs.
*   **shadcn/ui**: A collection of re-usable components built with Radix UI and Tailwind CSS.
*   **Supabase**: An open-source Firebase alternative for backend services, including authentication and database.
*   **React Router**: A standard library for routing in React applications.
*   **React Query (`@tanstack/react-query`)**: For managing, caching, and synchronizing server state.
*   **Lucide React**: A collection of beautiful and customizable SVG icons.
*   **jsPDF**: A client-side JavaScript PDF generation library.
*   **Dnd Kit (`@dnd-kit`)**: A modular and performant drag and drop toolkit for React.

## Library Usage Rules

To maintain a consistent and efficient codebase, please follow these guidelines for library usage:

*   **UI Components**:
    *   **Prioritize shadcn/ui**: Always check if a suitable component exists within `shadcn/ui` first.
    *   **Custom Components**: If a `shadcn/ui` component does not fit the requirements or needs significant customization, create a new component in `src/components/`. **Never modify `shadcn/ui` components directly.**
*   **Styling**:
    *   **Tailwind CSS Only**: All styling must be done using Tailwind CSS utility classes. Avoid custom CSS files or inline styles unless absolutely necessary for dynamic values.
*   **Icons**:
    *   **Lucide React**: Use icons from the `lucide-react` library.
*   **State Management & Data Fetching**:
    *   **React Query**: For all server-side data fetching, caching, and synchronization, use `@tanstack/react-query`.
    *   **Local State**: For component-specific local state, use React's `useState` or `useReducer` hooks.
*   **Routing**:
    *   **React Router DOM**: Use `react-router-dom` for all client-side routing.
    *   **Route Definition**: All main application routes should be defined in `src/App.tsx`.
*   **Backend & Authentication**:
    *   **Supabase Client**: Interact with Supabase services (database, authentication, functions) using the `@supabase/supabase-js` client, imported from `src/integrations/supabase/client.ts`.
*   **PDF Generation**:
    *   **jsPDF**: Use `jspdf` for generating PDF documents, specifically for exporting coloring books.
*   **Drag and Drop**:
    *   **Dnd Kit**: Implement drag-and-drop functionality using `@dnd-kit/core` and `@dnd-kit/sortable`.
*   **Toasts/Notifications**:
    *   **Sonner**: For general, non-blocking notifications, use `sonner`.
    *   **shadcn/ui Toast**: For more persistent or action-oriented notifications, use the `useToast` hook from `src/hooks/use-toast.ts` which leverages `shadcn/ui`'s toast component.
*   **Date Handling**:
    *   **date-fns**: Use `date-fns` for all date manipulation and formatting.
*   **Form Handling**:
    *   **React Hook Form & Zod**: Use `react-hook-form` for form management and `zod` for schema validation.
*   **Utility Functions**:
    *   **Dedicated Files**: Create small, focused utility functions in `src/lib/` or `src/utils/` for reusable logic.
*   **File Structure**:
    *   `src/pages/`: For top-level page components.
    *   `src/components/`: For reusable UI components.
    *   `src/hooks/`: For custom React hooks.
    *   `src/lib/`: For general utility functions and helpers.
    *   `src/integrations/`: For third-party service integration logic (e.g., Supabase client).