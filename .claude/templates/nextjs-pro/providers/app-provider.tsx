'use client'

import { ReactNode } from 'react'
// import { ThemeProvider } from 'next-themes' // Uncomment when needed

interface AppProviderProps {
  children: ReactNode
}

/**
 * App-wide providers wrapper
 * Add more providers as needed (Theme, Auth, etc.)
 */
export function AppProvider({ children }: AppProviderProps) {
  return (
    <>
      {/* 
        Uncomment to enable dark mode:
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      */}
      {children}
    </>
  )
}
