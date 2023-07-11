import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

import { initializeApp } from 'firebase/app'
import { getAnalytics } from 'firebase/analytics'

const firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG ?? '')

// Initialize Firebase
const app = initializeApp(firebaseConfig)
getAnalytics(app)

createRoot(document.getElementById('app')!).render(<App />)
