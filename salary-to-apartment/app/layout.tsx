import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Salary-to-Apartment Translator | WeLeap',
  description: 'Turn your job offer into a clear rent range — before you sign anything.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
