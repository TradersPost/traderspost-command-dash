import './app.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import PolymarketApp from './PolymarketApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PolymarketApp />
  </StrictMode>
)
