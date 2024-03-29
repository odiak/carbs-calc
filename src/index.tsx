import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'
import { CssVarsProvider, extendTheme } from '@mui/joy'

const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG ?? '')

// Initialize Firebase
const app = initializeApp(firebaseConfig)
if (!['localhost', '127.0.0.1'].includes(location.hostname)) {
  getAnalytics(app)
}

const theme = extendTheme({
  fontFamily: {
    body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    display:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
  },
  components: {
    JoyButton: {
      styleOverrides: {
        root: ({ ownState }) => ({
          fontWeight: 'normal',
        }),
      },
    },
  },
})

createRoot(document.getElementById('app')!).render(
  <CssVarsProvider theme={theme}>
    <App />
  </CssVarsProvider>
)
