import { createFileRoute } from '@tanstack/react-router'
import { TermsPage } from '../components/marketing/TermsPage'

export const Route = createFileRoute('/terms')({
  component: TermsPage,
})
