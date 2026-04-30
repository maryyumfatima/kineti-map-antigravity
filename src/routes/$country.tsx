import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$country')({
  beforeLoad: ({ params }) => {
    const validCountries = ['gb', 'pk', 'au']
    if (!validCountries.includes(params.country.toLowerCase())) {
      throw redirect({
        to: '/gb/dashboard', // Default fallback
      })
    }
  },
  component: () => <Outlet />,
})
