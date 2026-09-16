import type { ReactNode } from 'react'

interface PlaceholderPanelProps {
  icon: ReactNode
  title: string
  body: string
  children?: ReactNode
}

function PlaceholderPanel({ icon, title, body, children }: PlaceholderPanelProps) {
  return (
    <section className="placeholder-panel">
      <div className="placeholder-panel__icon" aria-hidden="true">{icon}</div>
      <h2>{title}</h2>
      <p>{body}</p>
      {children}
    </section>
  )
}

export default PlaceholderPanel
