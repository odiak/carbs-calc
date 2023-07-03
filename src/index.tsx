import React, { FC } from 'react'
import { createRoot } from 'react-dom/client'

const App: FC = () => <p>hello</p>

createRoot(document.getElementById('app')!).render(<App />)
