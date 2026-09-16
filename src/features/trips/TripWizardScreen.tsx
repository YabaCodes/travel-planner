import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useNavigate } from 'react-router-dom'
import PageIntro from '../../shared/components/PageIntro'
import { tripService, type DestinationDraft } from '../../data/services/tripService'
import type { TravelerType, TripPace } from '../../data/types/entities'
import { formatDateRange } from '../../data/utils/tripDate'

const splitList = (value: string) => value.split(/[\n,]/).map((item) => item.trim()).filter(Boolean)
const joinList = (value: string[]) => value.join(', ')

const initialDestination = (): DestinationDraft => ({ city: '', region: '', country: '', timezone: '' })

function TripWizardScreen() {
  const navigate = useNavigate()
  const profile = useLiveQuery(() => tripService.getDefaultTravelProfile(), [])
  const profileApplied = useRef(false)
  const [step, setStep] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [datesUnknown, setDatesUnknown] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [destinations, setDestinations] = useState<DestinationDraft[]>([initialDestination()])

  const [travelerType, setTravelerType] = useState<TravelerType>('self')
  const [travelerCount, setTravelerCount] = useState(1)
  const [travelerNames, setTravelerNames] = useState<string[]>([''])

  const [pace, setPace] = useState<TripPace>('balanced')
  const [interests, setInterests] = useState('')
  const [dayStart, setDayStart] = useState('09:00')
  const [activitiesPerDay, setActivitiesPerDay] = useState(3)
  const [walkingTolerance, setWalkingTolerance] = useState<'low' | 'medium' | 'high'>('medium')
  const [saveAsProfile, setSaveAsProfile] = useState(false)

  const [mustDo, setMustDo] = useState('')
  const [wouldLike, setWouldLike] = useState('')
  const [foodRestrictions, setFoodRestrictions] = useState('')
  const [specialRequirements, setSpecialRequirements] = useState('')
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!profile || profileApplied.current) return
    profileApplied.current = true
    setPace(profile.pace)
    setInterests(joinList(profile.interests))
    setDayStart(profile.preferred_day_start ?? '09:00')
    setActivitiesPerDay(profile.major_activities_per_day ?? 3)
    setWalkingTolerance(profile.walking_tolerance ?? 'medium')
    setFoodRestrictions(joinList(profile.food_restrictions))
  }, [profile])

  const updateDestination = (index: number, key: keyof DestinationDraft, value: string) => {
    setDestinations((current) => current.map((destination, i) => i === index ? { ...destination, [key]: value } : destination))
  }

  const changeTravelerType = (value: TravelerType) => {
    setTravelerType(value)
    const count = value === 'self' ? 1 : value === 'partner_friend' ? 2 : Math.max(3, travelerCount)
    setTravelerCount(count)
    setTravelerNames((names) => Array.from({ length: count }, (_, index) => names[index] ?? ''))
  }

  const changeTravelerCount = (count: number) => {
    const safe = Math.max(1, Math.min(20, count))
    setTravelerCount(safe)
    setTravelerNames((names) => Array.from({ length: safe }, (_, index) => names[index] ?? ''))
  }

  const validateCurrentStep = () => {
    setError(null)
    if (step === 1) {
      if (!title.trim()) return 'Give this trip a title.'
      if (!destinations.some((destination) => destination.city.trim() && destination.country.trim())) return 'Add at least one city and country.'
      if (!datesUnknown) {
        if (!startDate || !endDate) return 'Choose departure and return dates, or mark the dates as unknown.'
        if (endDate < startDate) return 'Return date must be on or after the departure date.'
      }
    }
    return null
  }

  const next = () => {
    const message = validateCurrentStep()
    if (message) {
      setError(message)
      return
    }
    setStep((current) => Math.min(5, current + 1))
  }

  const createTrip = async () => {
    setBusy(true)
    setError(null)
    try {
      const id = await tripService.createTrip({
        title,
        startDate: datesUnknown ? null : startDate || null,
        endDate: datesUnknown ? null : endDate || null,
        destinations,
        travelerType,
        travelerCount,
        travelerNames,
        style: {
          pace,
          interests: splitList(interests),
          preferredDayStart: dayStart || null,
          majorActivitiesPerDay: activitiesPerDay || null,
          walkingTolerance,
        },
        requirements: {
          mustDo: splitList(mustDo),
          wouldLike: splitList(wouldLike),
          foodRestrictions: splitList(foodRestrictions),
          specialRequirements: splitList(specialRequirements),
          notes: notes.trim() || null,
        },
        saveAsProfile,
      })
      navigate(`/trip/${id}`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create this trip.')
    } finally {
      setBusy(false)
    }
  }

  const validDestinations = destinations.filter((destination) => destination.city.trim() && destination.country.trim())

  return (
    <div className="page-stack wizard-page">
      <PageIntro
        eyebrow="New trip"
        title="Build your trip brief"
        description="Start with the decisions that shape the trip. You can change all of this later."
      />

      <section className="wizard-shell">
        <div className="wizard-progress" aria-label={`Step ${step} of 5`}>
          {['Basics', 'Travelers', 'Style', 'Requirements', 'Review'].map((label, index) => (
            <button key={label} type="button" className={`wizard-progress__item${step === index + 1 ? ' is-active' : ''}${step > index + 1 ? ' is-complete' : ''}`} onClick={() => index + 1 < step && setStep(index + 1)}>
              <span>{index + 1}</span><small>{label}</small>
            </button>
          ))}
        </div>

        <div className="wizard-body">
          {step === 1 ? (
            <div className="form-stack">
              <div className="section-heading"><span className="eyebrow">Step 1</span><h2>Trip basics</h2><p>Name the trip, add destinations, and set dates if you know them.</p></div>
              <label className="field"><span>Trip title</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Spring in Italy" autoFocus /></label>

              <div className="form-subsection">
                <div className="form-subsection__title"><strong>Destinations</strong><button className="text-button" type="button" onClick={() => setDestinations((current) => [...current, initialDestination()])}>+ Add destination</button></div>
                {destinations.map((destination, index) => (
                  <div className="destination-editor" key={index}>
                    <div className="destination-editor__heading"><span>Destination {index + 1}</span>{destinations.length > 1 ? <button type="button" className="icon-text-button danger-text" onClick={() => setDestinations((current) => current.filter((_, i) => i !== index))}>Remove</button> : null}</div>
                    <div className="field-grid field-grid--2">
                      <label className="field"><span>City</span><input value={destination.city} onChange={(event) => updateDestination(index, 'city', event.target.value)} placeholder="City" /></label>
                      <label className="field"><span>Country</span><input value={destination.country} onChange={(event) => updateDestination(index, 'country', event.target.value)} placeholder="Country" /></label>
                    </div>
                    <div className="field-grid field-grid--2">
                      <label className="field"><span>Region <small>optional</small></span><input value={destination.region} onChange={(event) => updateDestination(index, 'region', event.target.value)} placeholder="State / region" /></label>
                      <label className="field"><span>Timezone <small>optional</small></span><input value={destination.timezone} onChange={(event) => updateDestination(index, 'timezone', event.target.value)} placeholder="e.g. Europe/Rome" /></label>
                    </div>
                  </div>
                ))}
              </div>

              <label className="check-row"><input type="checkbox" checked={datesUnknown} onChange={(event) => setDatesUnknown(event.target.checked)} /><span><strong>Dates are not decided yet</strong><small>Keep this trip as an idea and schedule it later.</small></span></label>
              {!datesUnknown ? <div className="field-grid field-grid--2">
                <label className="field"><span>Departure</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
                <label className="field"><span>Return</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
              </div> : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="form-stack">
              <div className="section-heading"><span className="eyebrow">Step 2</span><h2>Who is traveling?</h2><p>This helps the planner adapt pacing, bookings, and later packing.</p></div>
              <div className="choice-grid">
                {([['self', 'Just me'], ['partner_friend', 'Partner / friend'], ['group', 'Group'], ['family', 'Family']] as const).map(([value, label]) => <button key={value} type="button" className={`choice-card${travelerType === value ? ' is-selected' : ''}`} onClick={() => changeTravelerType(value)}><strong>{label}</strong></button>)}
              </div>
              <label className="field"><span>Number of travelers</span><input type="number" min="1" max="20" value={travelerCount} disabled={travelerType === 'self'} onChange={(event) => changeTravelerCount(Number(event.target.value))} /></label>
              <div className="form-subsection">
                <div className="form-subsection__title"><strong>Names <small>optional</small></strong></div>
                <div className="field-grid field-grid--2">
                  {travelerNames.map((name, index) => <label className="field" key={index}><span>{index === 0 ? 'Primary traveler' : `Traveler ${index + 1}`}</span><input value={name} onChange={(event) => setTravelerNames((current) => current.map((item, i) => i === index ? event.target.value : item))} placeholder="Name" /></label>)}
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="form-stack">
              <div className="section-heading"><span className="eyebrow">Step 3</span><h2>Travel style</h2><p>{profile ? 'Your saved travel profile has been copied into this trip. Adjust anything you want.' : 'Set the default rhythm for this trip.'}</p></div>
              <div className="segmented-control" role="group" aria-label="Trip pace">{(['relaxed', 'balanced', 'packed'] as TripPace[]).map((value) => <button type="button" key={value} className={pace === value ? 'is-selected' : ''} onClick={() => setPace(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div>
              <label className="field"><span>Interests</span><input value={interests} onChange={(event) => setInterests(event.target.value)} placeholder="Food, museums, nature, nightlife…" /><small>Separate items with commas.</small></label>
              <div className="field-grid field-grid--2">
                <label className="field"><span>Preferred day start</span><input type="time" value={dayStart} onChange={(event) => setDayStart(event.target.value)} /></label>
                <label className="field"><span>Major activities / day</span><input type="number" min="1" max="8" value={activitiesPerDay} onChange={(event) => setActivitiesPerDay(Number(event.target.value))} /></label>
              </div>
              <label className="field"><span>Walking tolerance</span><select value={walkingTolerance} onChange={(event) => setWalkingTolerance(event.target.value as 'low' | 'medium' | 'high')}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
              <label className="check-row"><input type="checkbox" checked={saveAsProfile} onChange={(event) => setSaveAsProfile(event.target.checked)} /><span><strong>Save this style as my default Travel Profile</strong><small>Future trips will start with a copy of these preferences. Existing trips will not change.</small></span></label>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="form-stack">
              <div className="section-heading"><span className="eyebrow">Step 4</span><h2>Requirements</h2><p>Capture the things the itinerary should respect. Everything here is optional.</p></div>
              <label className="field"><span>Must-do</span><textarea rows={3} value={mustDo} onChange={(event) => setMustDo(event.target.value)} placeholder="One item per line, or comma-separated" /></label>
              <label className="field"><span>Would like</span><textarea rows={3} value={wouldLike} onChange={(event) => setWouldLike(event.target.value)} placeholder="Things worth fitting in if time allows" /></label>
              <label className="field"><span>Food restrictions</span><input value={foodRestrictions} onChange={(event) => setFoodRestrictions(event.target.value)} placeholder="No pork, vegetarian, allergies…" /></label>
              <label className="field"><span>Special requirements</span><textarea rows={3} value={specialRequirements} onChange={(event) => setSpecialRequirements(event.target.value)} placeholder="Mobility, accessibility, work calls, luggage constraints…" /></label>
              <label className="field"><span>Trip notes</span><textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Anything else that should stay with this trip" /></label>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="form-stack">
              <div className="section-heading"><span className="eyebrow">Step 5</span><h2>Review your Trip Brief</h2><p>This becomes the structured source of truth for the trip. You can edit it later.</p></div>
              <div className="review-card">
                <div><span>Trip</span><strong>{title || 'Untitled trip'}</strong></div>
                <div><span>Destinations</span><strong>{validDestinations.map((destination) => `${destination.city}, ${destination.country}`).join(' · ')}</strong></div>
                <div><span>Dates</span><strong>{datesUnknown ? 'Not decided yet' : formatDateRange(startDate || null, endDate || null)}</strong></div>
                <div><span>Travelers</span><strong>{travelerCount} · {travelerType.replace('_', ' / ')}</strong></div>
                <div><span>Pace</span><strong>{pace} · {activitiesPerDay} major activities/day</strong></div>
                <div><span>Interests</span><strong>{interests || 'None specified'}</strong></div>
                <div><span>Must-do</span><strong>{splitList(mustDo).length ? splitList(mustDo).join(' · ') : 'None specified'}</strong></div>
                <div><span>Food restrictions</span><strong>{foodRestrictions || 'None specified'}</strong></div>
              </div>
            </div>
          ) : null}

          {error ? <p className="form-error" role="alert">{error}</p> : null}

          <div className="wizard-actions">
            <button className="button button--secondary" type="button" onClick={() => step === 1 ? navigate('/trips') : setStep((current) => current - 1)}>{step === 1 ? 'Cancel' : 'Back'}</button>
            {step < 5 ? <button className="button button--primary" type="button" onClick={next}>Continue</button> : <button className="button button--primary" type="button" disabled={busy} onClick={createTrip}>{busy ? 'Creating…' : 'Create trip'}</button>}
          </div>
        </div>
      </section>
    </div>
  )
}

export default TripWizardScreen
