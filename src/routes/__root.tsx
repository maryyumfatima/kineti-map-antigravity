import { createRootRoute, Outlet } from '@tanstack/react-router'
import { Helmet } from 'react-helmet-async'

export const Route = createRootRoute({
  component: () => (
    <>
      <Helmet>
        <link rel="alternate" hreflang="en-GB" href="https://kinetimap.app/" />
        <link rel="alternate" hreflang="x-default" href="https://kinetimap.app/" />
        <title>KinetiMap</title>
      </Helmet>
      <Outlet />
    </>
  ),
})
