import { useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

type WorkspaceTab = 'add' | 'update'

const tabs: { id: WorkspaceTab; label: string }[] = [
  { id: 'add', label: 'Add Record' },
  { id: 'update', label: 'Find & Update' },
]

export default function DataEntryPage() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('add')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  function activateTab(tab: WorkspaceTab, index: number) {
    setActiveTab(tab)
    tabRefs.current[index]?.focus()
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined

    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length
    if (event.key === 'Home') nextIndex = 0
    if (event.key === 'End') nextIndex = tabs.length - 1

    if (nextIndex !== undefined) {
      event.preventDefault()
      activateTab(tabs[nextIndex].id, nextIndex)
    }
  }

  return (
    <main className="data-entry-page" id="main-content">
      <header className="data-entry-page__heading">
        <p className="eyebrow">Researcher workspace</p>
        <h1>Manage business records</h1>
        <p>
          Add a new record or find an individual record to update. Changes will be submitted through
          the researcher API once its schema and endpoints are finalized.
        </p>
      </header>

      <section className="data-entry-workspace" aria-label="Record management workspace">
        <div className="data-entry-tabs" role="tablist" aria-label="Record management tasks">
          {tabs.map((tab, index) => (
            <button
              aria-controls={`${tab.id}-record-panel`}
              aria-selected={activeTab === tab.id}
              className={`data-entry-tab${activeTab === tab.id ? ' data-entry-tab--active' : ''}`}
              id={`${tab.id}-record-tab`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              role="tab"
              tabIndex={activeTab === tab.id ? 0 : -1}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'add' ? (
          <section
            aria-labelledby="add-record-tab"
            className="data-entry-panel"
            id="add-record-panel"
            role="tabpanel"
            tabIndex={0}
          >
            <div className="data-entry-panel__icon" aria-hidden="true">
              +
            </div>
            <div className="data-entry-panel__content">
              <p className="eyebrow">New record</p>
              <h2>The add-record form is being prepared</h2>
              <p>
                The researchers are finalizing which fields a business record needs. The form will
                use those approved fields and validate entries before sending them to FastAPI.
              </p>
              <p className="data-entry-panel__note">
                No data can be submitted from this preview while the schema and write endpoint are
                pending.
              </p>
            </div>
          </section>
        ) : (
          <section
            aria-labelledby="update-record-tab"
            className="data-entry-panel"
            id="update-record-panel"
            role="tabpanel"
            tabIndex={0}
          >
            <div className="data-entry-panel__icon data-entry-panel__icon--update" aria-hidden="true">
              ↻
            </div>
            <div className="data-entry-panel__content">
              <p className="eyebrow">Individual record updates</p>
              <h2>Find and update one record</h2>
              <p>
                Search for a specific business record, review its current details, and edit that
                record. This workflow is for individual updates, not replacing the full dataset.
              </p>
              <p className="data-entry-panel__note">
                Record search and editing will be connected after the researchers approve the schema
                and the FastAPI update endpoint is available.
              </p>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}
