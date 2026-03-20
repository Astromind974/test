import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default marker icons broken by webpack/vite bundling
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIcon2xUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIcon2xUrl,
  shadowUrl: markerShadowUrl,
})

export default function MapTab() {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/api/locations')
      .then((res) => {
        if (!res.ok) throw new Error(`Erreur serveur : ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setLocations(data.locations || [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <p className="map-status">⏳ Chargement des positions…</p>
  }

  if (error) {
    return <p className="map-status error-msg">⚠️ {error}</p>
  }

  if (locations.length === 0) {
    return (
      <p className="map-status">
        📭 Aucune position géographique enregistrée dans la base de données.
      </p>
    )
  }

  // Center map on the average position of all markers
  const avgLat = locations.reduce((s, l) => s + l.latitude, 0) / locations.length
  const avgLon = locations.reduce((s, l) => s + l.longitude, 0) / locations.length

  const plural = locations.length > 1 ? 's' : ''

  return (
    <div className="map-wrapper">
      <p className="map-count">
        📍 {locations.length} position{plural} géographique{plural} enregistrée{plural}
      </p>
      <MapContainer
        center={[avgLat, avgLon]}
        zoom={5}
        className="leaflet-map"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {locations.map((loc) => (
          <Marker key={loc.id} position={[loc.latitude, loc.longitude]}>
            <Popup>
              <strong>{loc.top1_label.replace(/_/g, ' ')}</strong>
              <br />
              Score : {loc.top1_score.toFixed(2)}&nbsp;%
              <br />
              Source : {loc.source}
              <br />
              📅 {new Date(loc.timestamp).toLocaleString('fr-FR')}
              <br />
              📍 {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
