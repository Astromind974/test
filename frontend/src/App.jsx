import React, { useState, useRef, useCallback } from 'react';

const MAX_FILES = 10;

function fileKey(f) {
  return f.name + '-' + f.size;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isUrl(str) {
  return str.startsWith('http://') || str.startsWith('https://');
}

function getUrlList(text) {
  return text
    .split('\n')
    .map(u => u.trim())
    .filter(u => {
      if (!u) return false;
      try {
        const parsed = new URL(u);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    });
}

// ── Thumbnail component ────────────────────────────────────────────────────
function ThumbItem({ file, index, onRemove }) {
  const [src, setSrc] = useState('');
  React.useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="thumb-item">
      <img src={src} alt={file.name} />
      <button className="remove-btn" title="Retirer" onClick={() => onRemove(index)}>✕</button>
      <span className="fname">{file.name}</span>
    </div>
  );
}

// ── Result card component ──────────────────────────────────────────────────
function ResultCard({ result, fileMap }) {
  const medals = ['🥇 ', '🥈 ', '🥉 ', '', ''];

  const thumbSrc = React.useMemo(() => {
    if (fileMap[result.filename]) {
      return URL.createObjectURL(fileMap[result.filename]);
    }
    if (isUrl(result.filename)) return result.filename;
    return null;
  }, [result.filename, fileMap]);

  React.useEffect(() => {
    return () => {
      if (fileMap[result.filename] && thumbSrc && !isUrl(thumbSrc)) {
        URL.revokeObjectURL(thumbSrc);
      }
    };
  }, [thumbSrc, result.filename, fileMap]);

  let badge;
  if (result.animal_detected) {
    badge = <span className="badge badge-green">✅ Animal détecté</span>;
  } else if (result.animal_in_top5) {
    badge = <span className="badge badge-yellow">⚠️ Animal possible</span>;
  } else {
    badge = <span className="badge badge-red">❌ Pas d&apos;animal</span>;
  }

  return (
    <div className="result-card">
      <div className="card-thumb">
        {thumbSrc && <img src={thumbSrc} alt={result.filename} />}
      </div>
      <div className="card-body">
        <div className="card-title" title={result.filename}>{result.filename}</div>
        {badge}

        {result.animal_detected && result.top5 && result.top5.length > 0 && (
          <ul className="pred-list">
            {result.top5.map((pred, i) => (
              <li key={i}>
                <div className="pred-label">
                  <span>{(medals[i] || '') + pred.label}</span>
                  <span>{pred.score.toFixed(1)} %</span>
                </div>
                <div className="pred-bar-bg">
                  <BarWithAnimation width={Math.min(pred.score, 100)} isTop={i === 0} />
                </div>
              </li>
            ))}
          </ul>
        )}

        {!result.animal_detected && result.animal_in_top5 && (
          <ul className="pred-list">
            <li>
              <div className="pred-label">
                <span>{result.animal_in_top5.label}</span>
                <span>{result.animal_in_top5.score.toFixed(1)} %</span>
              </div>
              <div className="pred-bar-bg">
                <BarWithAnimation width={Math.min(result.animal_in_top5.score, 100)} isTop />
              </div>
            </li>
          </ul>
        )}

        {!result.animal_detected && !result.animal_in_top5 && (
          <p style={{ fontSize: '.85rem', color: '#9b2c2c', marginTop: '.5rem' }}>
            Ce n&apos;est pas un animal.
          </p>
        )}

        <p className="db-note">💾 Sauvegardé en base (id={result.db_id})</p>
      </div>
    </div>
  );
}

function BarWithAnimation({ width, isTop }) {
  const [w, setW] = useState(0);
  React.useEffect(() => {
    const t = setTimeout(() => setW(width), 50);
    return () => clearTimeout(t);
  }, [width]);
  return <div className={`pred-bar${isTop ? ' top' : ''}`} style={{ width: `${w}%` }} />;
}

// ── Main App component ─────────────────────────────────────────────────────
export default function App() {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [urlText, setUrlText] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultsData, setResultsData] = useState(null);
  const [globalError, setGlobalError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const resultsSectionRef = useRef(null);

  const urlList = getUrlList(urlText);
  const totalCount = selectedFiles.length + urlList.length;

  const fileMap = React.useMemo(() => {
    const map = {};
    selectedFiles.forEach(f => { map[f.name] = f; });
    return map;
  }, [selectedFiles]);

  const addFiles = useCallback((newFiles) => {
    setSelectedFiles(prev => {
      const existing = new Set(prev.map(fileKey));
      const toAdd = [];
      for (const f of newFiles) {
        if (prev.length + toAdd.length >= MAX_FILES) break;
        if (!existing.has(fileKey(f))) {
          existing.add(fileKey(f));
          toAdd.push(f);
        }
      }
      return [...prev, ...toAdd];
    });
  }, []);

  const removeFile = useCallback((idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles([...e.dataTransfer.files].filter(f => f.type.startsWith('image/')));
  }, [addFiles]);

  const handleFileInput = useCallback((e) => {
    addFiles([...e.target.files]);
    e.target.value = '';
  }, [addFiles]);

  const handleAnalyze = async () => {
    if (totalCount === 0) return;

    const formData = new FormData();
    selectedFiles.forEach(f => formData.append('images', f));
    urlList.forEach(u => formData.append('urls', u));

    setLoading(true);
    setResultsData(null);
    setGlobalError(null);

    try {
      const resp = await fetch('/api/analyze', { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok) {
        setGlobalError(data.error || 'Erreur inconnue.');
      } else {
        setResultsData(data);
        setTimeout(() => {
          resultsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }
    } catch (err) {
      setGlobalError('Erreur réseau : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const counterWarn = totalCount >= MAX_FILES;

  return (
    <>
      <header>
        <span style={{ fontSize: '2rem' }}>🐾</span>
        <div>
          <h1>Identificateur d&apos;Animaux</h1>
          <p>Téléchargez de 1 à 10 photos — le modèle MobileNetV2 les analyse en simultané</p>
        </div>
      </header>

      <main>
        <div className="upload-card">
          {/* Drop zone */}
          <div
            id="drop-zone"
            className={dragOver ? 'drag-over' : ''}
            role="button"
            aria-label="Zone de dépôt d'images"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <span className="icon">📁</span>
            <p>Glissez-déposez vos images ici<br />ou <strong>cliquez pour sélectionner</strong></p>
            <p style={{ fontSize: '.8rem', marginTop: '.5rem', color: '#718096' }}>
              Formats acceptés : JPG, PNG, GIF, WebP — max 10 fichiers
            </p>
          </div>
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          <div id="file-counter" className={counterWarn ? 'warn' : ''}>
            {selectedFiles.length} fichier(s) + {urlList.length} URL(s) = {totalCount} / {MAX_FILES} image(s)
          </div>

          {/* Thumbnails */}
          {selectedFiles.length > 0 && (
            <div id="thumb-grid">
              {selectedFiles.map((file, idx) => (
                <ThumbItem key={fileKey(file)} file={file} index={idx} onRemove={removeFile} />
              ))}
            </div>
          )}

          {/* URL input */}
          <label className="url-section-label" htmlFor="url-input">
            Ou entrez des URLs d&apos;images (une par ligne) :
          </label>
          <textarea
            id="url-input"
            placeholder={'https://exemple.com/image1.jpg\nhttps://exemple.com/image2.png'}
            value={urlText}
            onChange={e => setUrlText(e.target.value)}
          />

          <button
            id="btn-analyze"
            disabled={totalCount === 0 || loading}
            onClick={handleAnalyze}
          >
            🔍 Analyser les images
          </button>
        </div>

        {/* Spinner */}
        {loading && (
          <div id="spinner">
            <div className="ring" />
            <p>Analyse en cours… Merci de patienter.</p>
          </div>
        )}

        {/* Global error */}
        {globalError && !loading && (
          <div id="results-section" ref={resultsSectionRef}>
            <h2>Résultats</h2>
            <div className="results-grid">
              <div className="error-card">
                <strong>⚠️ Erreur</strong><br />
                <span dangerouslySetInnerHTML={{ __html: escHtml(globalError) }} />
              </div>
            </div>
          </div>
        )}

        {/* Results section */}
        {resultsData && !loading && (
          <div id="results-section" ref={resultsSectionRef}>
            <h2 id="results-title">
              Résultats — {resultsData.success_count} analyse(s) réussie(s)
              {resultsData.error_count > 0 && `, ${resultsData.error_count} erreur(s)`}
            </h2>
            <div className="results-grid">
              {(resultsData.results || []).map((r, i) => (
                <ResultCard key={i} result={r} fileMap={fileMap} />
              ))}
              {(resultsData.errors || []).map((e, i) => (
                <div key={`err-${i}`} className="error-card">
                  <strong>⚠️ {e.filename}</strong><br />{e.error}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  );
}
