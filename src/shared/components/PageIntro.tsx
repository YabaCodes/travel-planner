import type { ReactNode } from 'react'

interface PageIntroProps {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}

function PageIntro({ eyebrow, title, description, action }: PageIntroProps) {
  return (
    <section className="page-intro">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-intro__description">{description}</p>
      </div>
      {action && <div className="page-intro__action">{action}</div>}
    </section>
  )
}

export default PageIntro
