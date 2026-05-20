import { createFileRoute } from '@tanstack/react-router'
import { Homepage } from '../components/marketing/Homepage'

export const Route = createFileRoute('/')({
  component: Homepage,
})
