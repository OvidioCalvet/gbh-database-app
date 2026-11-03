import { useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import BusinessForm from '../features/database/BusinessForm'
import { detailToFormValues } from '../features/database/businessFormValues'
import {
  BusinessesApiError,
  fetchBusiness,
  fetchBusinesses,
  type BusinessDetail,
  type BusinessRecord,
} from '../features/database/businessesApi'

type WorkspaceTab = 'add' | 'update'

const tabs: { id: WorkspaceTab; label: string }[] = [
  { id: 'add', label: 'Add Record' },
  { id: 'update', label: 'Find & Update' },
]

function describeError(error: unknown): string {
  if (error instanceof BusinessesApiError) {
    if (error.status === 401) {
      return 'Your session has expired. Sign in again to continue.'
    }
    return error.message
  }

  return 'The database request failed. Check your connection and try again.'
}

export default function DataEntryPage() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('add')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  const [searchInput, setSearchInput] = useState('')
  const [results, setResults] = useState<BusinessRecord[] | null>(null)
  const [resultTotal, setResultTotal] = useState(0)
  const [searchError, setSearchError] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selected, setSelected] = useState<BusinessDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)

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

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchInput.trim()

    if (!query) {
      setSearchError('Enter a business name, owner, address, or industry.')
      setResults(null)
      return
    }

    setSearchError('')
    setIsSearching(true)
    setSelected(null)

    try {
      const page = await fetchBusinesses({ offset: 0, limit: 10, query })
      setResults(page.items)
      setResultTotal(page.total)
    } catch (error) {
      setSearchError(describeError(error))
      setResults(null)
      setResultTotal(0)
    } finally {
      setIsSearching(false)
    }
  }

  async function openRecord(record: BusinessRecord) {
    setDetailError('')
    setIsLoadingDetail(true)
    setSelected(null)

    try {
      setSelected(await fetchBusiness(record.id))
    } catch (error) {
      setDetailError(describeError(error))
    } finally {
      setIsLoadingDetail(false)
    }
  }

  function handleRecordSaved(detail: BusinessDetail) {
    setSelected(detail)
    setResults((current) =>
      current?.map((record) =>
        record.id === detail.id
          ? {
              ...record,
              bizId: detail.bizId,
              businessName: detail.businessName,
              broadIndustry: detail.broadIndustry,
              specificIndustry: detail.specificIndustry,
              appearanceDecade: detail.appearanceDecade,
              sourceYear: detail.sourceYear,
              race: detail.race,
              gender: detail.gender,
              ownerName: detail.ownerName,
              address: detail.address,
            }
          : record,
      ) ?? current,
    )
  }

  return (
    <main className="data-entry-page" id="main-content">
      <header className="data-entry-page__heading">
        <p className="eyebrow">Researcher workspace</p>
        <h1>Manage business records</h1>
        <p>
          Add a new record or search for an existing business to update one record at a time.
          Changes are saved directly to the research database and are attributed to your account.
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
            className="data-entry-panel data-entry-panel--form"
            id="add-record-panel"
            role="tabpanel"
            tabIndex={0}
          >
            <div className="data-entry-panel__intro">
              <p className="eyebrow">New record</p>
              <h2>Add a business record</h2>
              <p>
                Only the business name is required. Leave a field blank when the research does not
                provide a value; blank fields are stored as unknown rather than as empty text.
              </p>
            </div>
            <BusinessForm mode="create" />
          </section>
        ) : (
          <section
            aria-labelledby="update-record-tab"
            className="data-entry-panel data-entry-panel--form"
            id="update-record-panel"
            role="tabpanel"
            tabIndex={0}
          >
            {selected ? (
              <div className="record-edit">
                <div className="record-edit__heading">
                  <div>
                    <p className="eyebrow">Editing record #{selected.id}</p>
                    <h2>{selected.businessName}</h2>
                    <p className="record-edit__meta">
                      {selected.bizId}
                      {selected.updatedBy
                        ? ` · Last saved by ${selected.updatedBy}`
                        : ' · Imported record'}
                      {selected.updatedAt
                        ? ` on ${new Date(selected.updatedAt).toLocaleString()}`
                        : ''}
                    </p>
                  </div>
                </div>
                <BusinessForm
                  key={selected.id}
                  mode="edit"
                  recordId={selected.id}
                  initialValues={detailToFormValues(selected)}
                  onSaved={handleRecordSaved}
                  onCancel={() => setSelected(null)}
                />
              </div>
            ) : (
              <div className="record-search">
                <div className="data-entry-panel__intro">
                  <p className="eyebrow">Individual record updates</p>
                  <h2>Find and update one record</h2>
                  <p>
                    Search by business name, owner, address, or industry. Select a record to load
                    its full details, then save only that record.
                  </p>
                </div>

                <form className="record-search__form" role="search" onSubmit={handleSearch}>
                  <label htmlFor="record-search-input">Search records</label>
                  <div className="record-search__field">
                    <input
                      id="record-search-input"
                      type="search"
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Business name, owner, address, or industry"
                      autoComplete="off"
                    />
                    <button type="submit" disabled={isSearching}>
                      {isSearching ? 'Searching…' : 'Search'}
                    </button>
                  </div>
                </form>

                {searchError && (
                  <p className="record-form__alert" role="alert">
                    {searchError}
                  </p>
                )}
                {detailError && (
                  <p className="record-form__alert" role="alert">
                    {detailError}
                  </p>
                )}
                {isLoadingDetail && (
                  <p className="record-search__status" role="status">
                    Loading the record…
                  </p>
                )}

                {results && (
                  <div className="record-search__results" aria-live="polite">
                    <p className="record-search__summary">
                      {resultTotal === 0
                        ? 'No records matched that search.'
                        : `Showing ${results.length} of ${resultTotal.toLocaleString()} matching records${
                            resultTotal > results.length ? '. Refine the search to narrow it down.' : '.'
                          }`}
                    </p>
                    {results.length > 0 && (
                      <ul className="record-search__list">
                        {results.map((record) => (
                          <li className="record-search__item" key={record.id}>
                            <div>
                              <h3>{record.businessName}</h3>
                              <p>
                                {[record.broadIndustry, record.appearanceDecade, record.sourceYear]
                                  .filter(Boolean)
                                  .join(' · ') || 'No classification recorded'}
                              </p>
                              <p className="record-search__address">
                                {record.address ?? 'No address recorded'}
                              </p>
                            </div>
                            <button type="button" onClick={() => openRecord(record)}>
                              Edit record
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  )
}
