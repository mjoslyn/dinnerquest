import { jsxRenderer } from 'hono/jsx-renderer'
import { Link, Script } from 'honox/server'

export default jsxRenderer(({ children, title, description, ogTitle, ogDescription, themeClass }) => {
  const pageTitle = title ?? 'Dinner Quest'
  const pageDescription = description ?? 'A text-based RPG for couples to decide on dinner for the week'
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={ogTitle ?? pageTitle} />
        <meta property="og:description" content={ogDescription ?? pageDescription} />
        <meta property="og:type" content="website" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=VT323&family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
        <Link href="/app/style.css" rel="stylesheet" />
        <Script src="/app/client.ts" async />
      </head>
      <body class={themeClass || undefined}>{children}</body>
    </html>
  )
})
