interface FatalAppScreenProps {
  eyebrow?: string
  title: string
  description: string
  detail?: string | null
  showDataLink?: boolean
}

function FatalAppScreen({ eyebrow = 'Travel Planner', title, description, detail = null, showDataLink = true }: FatalAppScreenProps) {
  const reload = () => window.location.reload()
  const openData = () => {
    window.location.hash = '/data'
    window.location.reload()
  }

  return (
    <main className="fatal-app-shell">
      <section className="fatal-app-card" role="alert">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        {detail ? <details className="fatal-app-detail"><summary>Technical detail</summary><code>{detail}</code></details> : null}
        <div className="inline-actions">
          <button className="button button--primary" type="button" onClick={reload}>Reload app</button>
          {showDataLink ? <button className="button button--secondary" type="button" onClick={openData}>Open Data & Backup</button> : null}
        </div>
      </section>
    </main>
  )
}

export default FatalAppScreen
