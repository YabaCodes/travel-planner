import { useNavigate } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'

function NotFoundScreen() {
  const navigate = useNavigate()

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Navigation"
        title="Page not found"
        description="This Travel Planner link does not point to a current screen. Your trip data has not been changed."
        action={<button className="button button--primary" type="button" onClick={() => navigate('/trips', { replace: true })}>Back to My Trips</button>}
      />
      <section className="placeholder-panel">
        <h2>Nothing to recover here</h2>
        <p>Use My Trips to reopen your workspace, or Data & Backup if you were following an older saved link and want to verify your local data.</p>
        <div className="inline-actions empty-state-action">
          <button className="button button--secondary" type="button" onClick={() => navigate('/data')}>Data & Backup</button>
          <button className="button button--primary" type="button" onClick={() => navigate('/trips')}>My Trips</button>
        </div>
      </section>
    </div>
  )
}

export default NotFoundScreen
