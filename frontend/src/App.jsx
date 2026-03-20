import { useState, useCallback, useMemo } from 'react'
import './App.css'

const MAX_FILES = 10
const LOW_CONFIDENCE_THRESHOLD = 30

function ConfidenceBar({ score }) {
  return (
    <div className="confidence-bar-container">
      <div className="confidence-bar" style={{ width: `${score}%` }} />
      <span className="confidence-label">{score.toFixed(2)} %</span>
    </div>
  )
}

function ResultCard({ result }) {
  const lowConfidence = result.animal_detected && result.best_score < LOW_CONFIDENCE_THRESHOLD

  let cardClass
  let badge
  if (result.animal_detected && !lowConfidence) {
    cardClass = 'result-card animal'
    badge = '✅ Animal détecté'
  } else if (result.animal_detected && lowConfidence) {
    cardClass = 'result-card maybe-animal'
    badge = '⚠️ Cela pourrait être un animal'
  } else if (!result.animal_detected && result.animal_in_top5) {
    cardClass = 'result-card maybe-animal'
    badge = '⚠️ Cela pourrait être un animal'
  } else {
    cardClass = 'result-card no-animal'
    badge = '❌ Aucun animal dans cette image'
  }

  return (
    <div className={cardClass}>
      <h3 className="result-filename">{result.filename}</h3>
      <div className="result-badge">{badge}</div>
      <p className="result-best">
        <strong>Meilleure prédiction :</strong>{' '}
        {result.best_label} — {result.best_score.toFixed(2)} %
      </p>
      {result.animal_detected && result.top5.length > 0 && (
        <ul className="result-top5">
          {result.top5.map((item) => (
            <li key={item.label}>
              <span className="pred-label">{item.label}</span>
              <ConfidenceBar score={item.score} />
            </li>
          ))}
        </ul>
      )}
      {lowConfidence && (
        <p className="result-hint">
          ⚠️ Faible confiance — cela pourrait être :{' '}
          <strong>{result.best_label}</strong> ({result.best_score.toFixed(2)} %)
        </p>
      )}
      {!result.animal_detected && result.animal_in_top5 && (
        <p className="result-hint">
          ⚠️ Cela pourrait être :{' '}
          <strong>{result.animal_in_top5.label}</strong> ({result.animal_in_top5.score.toFixed(2)} %)
        </p>
      )}
      {!result.animal_detected && !result.animal_in_top5 && (
        <p className="result-no-animal">
          ❌ Aucun animal dans cette image.
        </p>
      )}
      <p className="result-dbid">💾 Sauvegardé (id={result.db_id})</p>
    </div>
  )
}

export default function App() {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)

  const urls = useMemo(
    () => urlInput.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean),
    [urlInput],
  )

  const addFiles = useCallback((newFiles) => {
    setFiles((prev) => {
      const combined = [...prev, ...newFiles].slice(0, MAX_FILES)
      const newPreviews = combined.map((f) => ({
        name: f.name,
        url: URL.createObjectURL(f),
      }))
      setPreviews(newPreviews)
      return combined
    })
  }, [])

  const removeFile = (index) => {
    setFiles((prev) => {
      const updated = prev.filter((_, i) => i !== index)
      setPreviews(updated.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })))
      return updated
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    addFiles(Array.from(e.dataTransfer.files))
  }

  const handleFileInput = (e) => {
    addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (files.length === 0 && urls.length === 0) return
    setLoading(true)
    setError(null)
    setResponse(null)

    const formData = new FormData()
    files.forEach((f) => formData.append('images', f))
    urls.forEach((url) => formData.append('urls', url))

    try {
      const res = await fetch('/api/analyze', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erreur serveur')
      } else {
        setResponse(data)
      }
    } catch (err) {
      setError(`Impossible de joindre le serveur : ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const hasInput = files.length > 0 || urls.length > 0

  return (
    <div className="app">
      <header className="app-header">
        <h1>🐾 Animal Identifier</h1>
        <p>Identifiez des animaux dans vos photos grâce à MobileNetV2</p>
      </header>

      <main>
        <form onSubmit={handleSubmit}>
          <div
            className="dropzone"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {previews.length === 0 ? (
              <p>Glissez-déposez vos images ici ou</p>
            ) : (
              <div className="preview-grid">
                {previews.map((p, i) => (
                  <div key={p.name + i} className="preview-item">
                    <img src={p.url} alt={p.name} />
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeFile(i)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="file-label">
              📁 Sélectionner des images
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                hidden
              />
            </label>
            <p className="hint">JPG, PNG, GIF, WebP — maximum {MAX_FILES} images</p>
          </div>

          <div className="url-input-section">
            <label className="url-input-label" htmlFor="url-input">
              🔗 Ou entrez des URLs d'images (une par ligne)
            </label>
            <textarea
              id="url-input"
              className="url-textarea"
              placeholder={'https://example.com/image.jpg\nhttps://example.com/photo.png'}
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              rows={3}
            />
            {urls.length > 0 && (
              <div className="url-preview-list">
                {urls.map((url, i) => (
                  <div key={i} className="url-preview-item">
                    <img
                      src={url}
                      alt={`URL ${i + 1}`}
                      className="url-preview-img"
                      onError={(e) => { e.currentTarget.classList.add('url-img-error') }}
                    />
                    <span className="url-preview-text">{url}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <p className="error-msg">⚠️ {error}</p>}

          <button
            type="submit"
            className="analyze-btn"
            disabled={!hasInput || loading}
          >
            {loading ? '⏳ Analyse en cours…' : '🔍 Analyser les images'}
          </button>
        </form>

        {response && (
          <section className="results-section">
            <h2>
              Résultats — {response.success_count}/{response.total} image
              {response.total > 1 ? 's' : ''} analysée{response.total > 1 ? 's' : ''}
            </h2>
            {response.errors.map((err) => (
              <div key={err.filename} className="result-card error-card">
                <h3>{err.filename}</h3>
                <p>❌ {err.error}</p>
              </div>
            ))}
            <div className="results-grid">
              {response.results.map((result) => (
                <ResultCard key={result.filename} result={result} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
