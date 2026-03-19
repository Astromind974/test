import { useState, useCallback } from 'react'
import './App.css'

const MAX_FILES = 10

function ConfidenceBar({ score }) {
  return (
    <div className="confidence-bar-container">
      <div className="confidence-bar" style={{ width: `${score}%` }} />
      <span className="confidence-label">{score.toFixed(2)} %</span>
    </div>
  )
}

function ResultCard({ result }) {
  return (
    <div className={`result-card ${result.animal_detected ? 'animal' : 'no-animal'}`}>
      <h3 className="result-filename">{result.filename}</h3>
      <div className="result-badge">
        {result.animal_detected ? '✅ Animal détecté' : '❌ Aucun animal'}
      </div>
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
      {!result.animal_detected && result.animal_in_top5 && (
        <p className="result-hint">
          ⚠️ Animal possible dans le top-5 :{' '}
          <strong>{result.animal_in_top5.label}</strong> ({result.animal_in_top5.score.toFixed(2)} %)
        </p>
      )}
      <p className="result-dbid">💾 Sauvegardé (id={result.db_id})</p>
    </div>
  )
}

export default function App() {
  const [files, setFiles] = useState([])
  const [previews, setPreviews] = useState([])
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)

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
    if (files.length === 0) return
    setLoading(true)
    setError(null)
    setResponse(null)

    const formData = new FormData()
    files.forEach((f) => formData.append('images', f))

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

          {error && <p className="error-msg">⚠️ {error}</p>}

          <button
            type="submit"
            className="analyze-btn"
            disabled={files.length === 0 || loading}
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
