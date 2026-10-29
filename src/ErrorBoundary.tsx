import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<{children: ReactNode},{hasError:boolean}> {
  state = { hasError: false }
  static getDerivedStateFromError(){ return { hasError: true } }
  componentDidCatch(error: Error, info: ErrorInfo){
    console.error('Minutes Workspace failed safely', error, info.componentStack)
  }
  render(){
    if(this.state.hasError) return <main className="fatal-error" role="alert"><span className="brand-mark">MW</span><h1>We could not open this workspace.</h1><p>Your browser data has not been deleted. Reload the page to try again.</p><button className="primary" onClick={()=>location.reload()}>Reload workspace</button></main>
    return this.props.children
  }
}
