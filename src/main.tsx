import React from 'react'
import ReactDOM from 'react-dom/client'
import PhaseOneApp from './PhaseOneApp'
import { ErrorBoundary } from './ErrorBoundary'
import './styles.css'
import './responsive.css'
import './dashboard.css'
import './preparation.css'
import './live.css'
import './review.css'

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ErrorBoundary><PhaseOneApp /></ErrorBoundary></React.StrictMode>)
