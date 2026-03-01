import { useMemo, useState } from 'react'
import AddressSearch from '../../components/AddressSearch/AddressSearch'
import './RouteBuilderPage.css'

function RouteBuilderPage({ actionLoading, authError, onSubmitRoute, onCancel }) {
  const [activeTab, setActiveTab] = useState('driver')
  const [drivers, setDrivers] = useState([])
  const [passengers, setPassengers] = useState([])
  const [destination, setDestination] = useState({ displayName: '', lat: null, lng: null })
  const [driverForm, setDriverForm] = useState({ name: '', address: '', lat: null, lng: null, capacity: '1' })
  const [passengerForm, setPassengerForm] = useState({ name: '', address: '', lat: null, lng: null })
  const [localError, setLocalError] = useState('')

  const canCalculate = useMemo(
    () => drivers.length > 0 && passengers.length > 0 && destination.displayName.trim().length > 0,
    [drivers.length, passengers.length, destination.displayName],
  )

  function createLocalUserId(role) {
    return `${role}-${Date.now()}-${Math.floor(Math.random() * 100000)}`
  }

  function handleAddDriver() {
    const name = driverForm.name.trim()
    const address = driverForm.address.trim()
    const capacity = Number(driverForm.capacity)

    if (!name || !address || !Number.isInteger(capacity) || capacity < 1) {
      setLocalError('Driver requires name, address, and capacity of at least 1')
      return
    }

    const userId = createLocalUserId('driver')
    setDrivers((prev) => [...prev, { id: userId, userId, name, address, lat: driverForm.lat, lng: driverForm.lng, capacity }])
    setDriverForm({ name: '', address: '', lat: null, lng: null, capacity: '1' })
    setLocalError('')
  }

  function handleAddPassenger() {
    const name = passengerForm.name.trim()
    const address = passengerForm.address.trim()

    if (!name || !address) {
      setLocalError('Passenger requires name and address')
      return
    }

    const userId = createLocalUserId('passenger')
    setPassengers((prev) => [...prev, { id: userId, userId, name, address, lat: passengerForm.lat, lng: passengerForm.lng, seatsRequired: 1 }])
    setPassengerForm({ name: '', address: '', lat: null, lng: null })
    setLocalError('')
  }

  function removeDriver(id) {
    setDrivers((prev) => prev.filter((driver) => driver.id !== id))
  }

  function removePassenger(id) {
    setPassengers((prev) => prev.filter((passenger) => passenger.id !== id))
  }

  async function handleCalculate() {
    if (!canCalculate || actionLoading) {
      if (!destination.displayName.trim()) {
        setLocalError('Destination is required before calculating the route')
      }
      return
    }

    await onSubmitRoute({
      drivers,
      passengers,
      destination: {
        address: destination.displayName,
        lat: destination.lat,
        lng: destination.lng,
      },
    })
  }

  return (
    <div className="route-builder-page shell">
      <section className="route-builder-card">
        <h1>Build Route Inputs</h1>
        <p>Add people to this route and calculate optimized assignments.</p>

        <div className="tab-panel">
          <div className="person-form-grid">
            <label htmlFor="route-destination">Destination</label>
            <AddressSearch
              id="route-destination"
              value={destination.displayName}
              placeholder="Search destination address or place name..."
              onChange={({ displayName, lat, lng }) => {
                setDestination({ displayName, lat, lng })
                setLocalError('')
              }}
            />
          </div>
        </div>

        <div className="route-builder-tabs" role="tablist" aria-label="Add people by role">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'driver' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('driver')}
            role="tab"
            aria-selected={activeTab === 'driver'}
          >
            Drivers
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'passenger' ? 'tab-btn-active' : ''}`}
            onClick={() => setActiveTab('passenger')}
            role="tab"
            aria-selected={activeTab === 'passenger'}
          >
            Passengers
          </button>
        </div>

        {activeTab === 'driver' ? (
          <div className="tab-panel" role="tabpanel">
            <div className="person-form-grid">
              <label htmlFor="driver-name">Name</label>
              <input
                id="driver-name"
                type="text"
                value={driverForm.name}
                onChange={(event) => setDriverForm((prev) => ({ ...prev, name: event.target.value }))}
              />

              <label htmlFor="driver-address">Address</label>
              <AddressSearch
                id="driver-address"
                value={driverForm.address}
                placeholder="Search address or place name..."
                onChange={({ displayName, lat, lng }) =>
                  setDriverForm((prev) => ({ ...prev, address: displayName, lat, lng }))
                }
              />

              <label htmlFor="driver-capacity">Capacity</label>
              <input
                id="driver-capacity"
                type="number"
                min="1"
                value={driverForm.capacity}
                onChange={(event) => setDriverForm((prev) => ({ ...prev, capacity: event.target.value }))}
              />
            </div>

            <button type="button" className="primary-btn" onClick={handleAddDriver}>
              Add driver
            </button>
          </div>
        ) : (
          <div className="tab-panel" role="tabpanel">
            <div className="person-form-grid">
              <label htmlFor="passenger-name">Name</label>
              <input
                id="passenger-name"
                type="text"
                value={passengerForm.name}
                onChange={(event) => setPassengerForm((prev) => ({ ...prev, name: event.target.value }))}
              />

              <label htmlFor="passenger-address">Address</label>
              <AddressSearch
                id="passenger-address"
                value={passengerForm.address}
                placeholder="Search address or place name..."
                onChange={({ displayName, lat, lng }) =>
                  setPassengerForm((prev) => ({ ...prev, address: displayName, lat, lng }))
                }
              />
            </div>

            <button type="button" className="primary-btn" onClick={handleAddPassenger}>
              Add passenger
            </button>
          </div>
        )}

        <div className="people-summary">
          <section>
            <h2>Drivers ({drivers.length})</h2>
            {drivers.length === 0 ? (
              <p className="summary-empty">No drivers added yet.</p>
            ) : (
              <ul className="summary-list">
                {drivers.map((driver) => (
                  <li key={driver.id}>
                    <span>{driver.name} · {driver.address} · capacity {driver.capacity}</span>
                    <button type="button" className="text-btn" onClick={() => removeDriver(driver.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2>Passengers ({passengers.length})</h2>
            {passengers.length === 0 ? (
              <p className="summary-empty">No passengers added yet.</p>
            ) : (
              <ul className="summary-list">
                {passengers.map((passenger) => (
                  <li key={passenger.id}>
                    <span>{passenger.name} · {passenger.address}</span>
                    <button type="button" className="text-btn" onClick={() => removePassenger(passenger.id)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {(localError || authError) && <p className="route-builder-error">{localError || authError}</p>}

        <div className="route-builder-actions">
          <button type="button" className="site-logout" onClick={onCancel}>
            Back
          </button>
          <button
            type="button"
            className="primary-btn"
            onClick={handleCalculate}
            disabled={!canCalculate || actionLoading}
          >
            {actionLoading ? 'Calculating...' : 'Calculate route'}
          </button>
        </div>
      </section>
    </div>
  )
}

export default RouteBuilderPage
