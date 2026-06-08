import { createFileRoute } from '@tanstack/react-router'
import { RefundPage } from '../components/marketing/RefundPage'

export const Route = createFileRoute('/refund')({
  component: RefundPage,
})
