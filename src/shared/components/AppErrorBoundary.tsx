import { Component, type ErrorInfo, type ReactNode } from 'react'
import FatalAppScreen from './FatalAppScreen'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Travel Planner UI failed', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <FatalAppScreen
          eyebrow="Recovery mode"
          title="Travel Planner hit an unexpected error"
          description="Your local trip database has not been intentionally cleared. Reload the app first. If the problem continues, Data & Backup is the safest place to export or restore your data."
          detail={this.state.error.message}
        />
      )
    }

    return this.props.children
  }
}

export default AppErrorBoundary
