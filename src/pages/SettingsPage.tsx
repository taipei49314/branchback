import { useRef, useState } from 'react'
import { useDecisionStore } from '@/application/useDecisionStore'
import type { ImportMode } from '@/storage/repository'
import { SCHEMA_VERSION } from '@/domain/types'
import { assessBackupHealth, assessLibraryHealth, backupHealthLabel } from '@/domain/backupHealth'

interface BackupPreview {
  schemaVersion: number | string
  exportedAt: string | null
  decisionCount: number
  titles: string[]
  healthStatus: string
  importable: boolean
  healthIssues: string[]
  healthWarnings: string[]
}

function previewBackup(raw: string): BackupPreview {
  const data = JSON.parse(raw) as {
    schemaVersion?: number
    exportedAt?: string
    decisions?: Array<{ title?: string }>
  }
  const decisions = Array.isArray(data.decisions) ? data.decisions : []
  const health = assessBackupHealth(data)
  return {
    schemaVersion: data.schemaVersion ?? 'unknown',
    exportedAt: data.exportedAt ?? null,
    decisionCount: decisions.length,
    titles: decisions.map((d) => d.title ?? '(untitled)').slice(0, 8),
    healthStatus: backupHealthLabel(health.status),
    importable: health.importable,
    healthIssues: health.issues,
    healthWarnings: health.warnings,
  }
}

export function SettingsPage() {
  const { exportJson, importJson, loadDemo, clearAll, decisions } =
    useDecisionStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [pendingRaw, setPendingRaw] = useState<string | null>(null)
  const [pendingMode, setPendingMode] = useState<ImportMode>('merge')
  const libraryHealth = assessLibraryHealth(decisions)

  async function onExport() {
    const json = await exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `branchback-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setMessage(
      `Backup downloaded (${decisions.length} decisions, schema ${SCHEMA_VERSION}).`,
    )
  }

  async function confirmImport() {
    if (!pendingRaw) return
    try {
      const n = await importJson(pendingRaw, pendingMode)
      setMessage(`Imported ${n} decisions (${pendingMode}).`)
      setError(null)
      setPreview(null)
      setPendingRaw(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Import failed'
      if (
        /SNAPSHOT_TAMPER|REVISION_|REPLACE_OMITS|INVARIANT|DESTRUCTIVE|UNSUPPORTED_SCHEMA/i.test(
          msg,
        )
      ) {
        setError(msg)
      } else if (/JSON|Unexpected token|schema|Zod|invalid/i.test(msg)) {
        setError(
          'This file failed validation as a BranchBack backup. Check schema version and export a fresh JSON backup.',
        )
      } else {
        setError(msg)
      }
    }
  }

  async function stageImport(file: File, mode: ImportMode) {
    try {
      const raw = await file.text()
      const p = previewBackup(raw)
      setPreview(p)
      setPendingRaw(raw)
      setPendingMode(mode)
      setError(null)
      setMessage(null)
      if (!p.importable) {
        setError(p.healthIssues.join(' ') || 'Backup failed health check.')
      }
    } catch {
      setError(
        'Could not read this file as JSON. Export a BranchBack backup and try again.',
      )
      setPreview(null)
      setPendingRaw(null)
    }
  }

  function pickFile(mode: ImportMode) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = () => {
      const file = input.files?.[0]
      if (file) void stageImport(file, mode)
    }
    input.click()
  }

  return (
    <div className="page narrow">
      <header className="page-header">
        <p className="eyebrow">Local data</p>
        <h1>Settings</h1>
        <p className="lede">
          No accounts. No cloud. Data stays in this browser&apos;s IndexedDB.
          Historical records are append-protected at the repository boundary.
        </p>
      </header>

      <section className="panel stack">
        <h2>Backup health</h2>
        <p className="muted">
          Current store: {decisions.length} decisions · schema {SCHEMA_VERSION}
        </p>
        <dl className="kv">
          <div>
            <dt>Health</dt>
            <dd>{backupHealthLabel(libraryHealth.status)}</dd>
          </div>
          <div>
            <dt>Committed</dt>
            <dd>{libraryHealth.committedCount}</dd>
          </div>
          <div>
            <dt>Reviewed</dt>
            <dd>{libraryHealth.reviewedCount}</dd>
          </div>
        </dl>
        {libraryHealth.warnings.length ? (
          <ul>
            {libraryHealth.warnings.slice(0, 5).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">No warnings on the current library.</p>
        )}
      </section>

      <section className="panel stack">
        <h2>Backup</h2>
        <button
          type="button"
          className="btn primary"
          onClick={() => void onExport()}
        >
          Download JSON backup
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void stageImport(file, 'merge')
          }}
        />
        <div className="form-actions">
          <button
            type="button"
            className="btn"
            onClick={() => fileRef.current?.click()}
          >
            Import JSON (merge)
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => pickFile('replace')}
          >
            Import JSON (replace)
          </button>
        </div>
        <p className="muted">
          <strong>merge</strong> upserts and never deletes.{' '}
          <strong>replace</strong> restores a full backup only if every
          currently committed decision is present — omitting committed history
          is rejected. Unknown future schema versions are rejected (fail
          closed).
        </p>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (
              window.confirm(
                'DESTRUCTIVE WIPE: erase ALL local decisions, then load this backup? Type-confirm in the next dialog.',
              ) &&
              window.confirm(
                'Final confirmation: erase existing historical records and load backup?',
              )
            ) {
              pickFile('destructive-wipe')
            }
          }}
        >
          Destructive wipe + import…
        </button>

        {preview ? (
          <div
            className="import-preview"
            role="region"
            aria-label="Import preview"
          >
            <h3>Import preview ({pendingMode})</h3>
            <dl className="kv">
              <div>
                <dt>Schema version</dt>
                <dd>{String(preview.schemaVersion)}</dd>
              </div>
              <div>
                <dt>Exported</dt>
                <dd>{preview.exportedAt?.slice(0, 19) ?? '—'}</dd>
              </div>
              <div>
                <dt>Decisions</dt>
                <dd>{preview.decisionCount}</dd>
              </div>
              <div>
                <dt>Health</dt>
                <dd>{preview.healthStatus}</dd>
              </div>
              <div>
                <dt>Importable</dt>
                <dd>{preview.importable ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
            {preview.healthIssues.length ? (
              <ul>
                {preview.healthIssues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : null}
            <ul>
              {preview.titles.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPreview(null)
                  setPendingRaw(null)
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={!preview.importable}
                onClick={() => void confirmImport()}
              >
                Confirm import
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <h2>Demo</h2>
        <button type="button" className="btn" onClick={() => void loadDemo()}>
          Load six-decision demo dataset
        </button>
      </section>

      <section className="panel stack">
        <h2>Danger zone</h2>
        <p className="muted">{decisions.length} decisions stored locally.</p>
        <button
          type="button"
          className="btn danger"
          onClick={() => {
            if (
              window.confirm(
                'Delete all local decisions and their historical records? This cannot be undone.',
              )
            ) {
              void clearAll()
                .then(() => setMessage('All local decisions cleared.'))
                .catch((e: unknown) =>
                  setError(e instanceof Error ? e.message : 'Clear failed'),
                )
            }
          }}
        >
          Clear all local data
        </button>
      </section>

      {message ? (
        <p className="ok" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
