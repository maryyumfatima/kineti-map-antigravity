import { createFileRoute } from '@tanstack/react-router';
import { Homepage } from '../components/marketing/Homepage';

// Public route for previewing the marketing homepage.
// No authentication or redirects are performed – the page is always shown.
export const Route = createFileRoute('/home')({
  component: Homepage,
});
