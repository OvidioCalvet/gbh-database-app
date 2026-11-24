import { useEffect, useState } from 'react'
import databaseHeroPhoto from '../assets/uf-research.jpg'
import {
  fetchBusinesses,
  fetchGenders,
  fetchIndustries,
  fetchRaces,
  type BusinessPage,
  type GenderCount,
  type IndustryCount,
  type RaceCount,
} from '../features/database/businessesApi'

const PAGE_SIZE = 25

interface BusinessRequest {
  page: number
  query: string
  industry: string | null
  gender: string | null
  race: string | null
}

interface LoadedPage {
  key: string
  data: BusinessPage
}

interface LoadFailure {
  key: string
  message: string
}

interface FilterOption {
  name: string
  count: number
}

interface FilterButtonGroupProps {
  id: string
  heading: string
  ariaLabel: string
  options: FilterOption[]
  selected: string | null
  onSelect: (value: string | null) => void
}

function FilterButtonGroup({
  id,
  heading,
  ariaLabel,
  options,
  selected,
  onSelect,
}: FilterButtonGroupProps) {
  return (
    <section className="database-category-filters" aria-labelledby={id}>
      <h3 id={id}>{heading}</h3>
      <div className="database-category-filters__buttons" role="group" aria-label={ariaLabel}>
        <button
          className={`database-category-button${selected === null ? ' database-category-button--active' : ''}`}
          type="button"
          aria-pressed={selected === null}
          onClick={() => onSelect(null)}
        >
          All
        </button>
        {options.map((option) => (
          <button
            className={`database-category-button${selected === option.name ? ' database-category-button--active' : ''}`}
            key={option.name}
            type="button"
            aria-pressed={selected === option.name}
            title={`${option.count.toLocaleString()} records`}
            onClick={() => onSelect(option.name)}
          >
            {option.name}
          </button>
        ))}
      </div>
    </section>
  )
}

export default function DatabasePage() {
  const [searchInput, setSearchInput] = useState('')
  const [request, setRequest] = useState<BusinessRequest>({
    page: 1,
    query: '',
    industry: null,
    gender: null,
    race: null,
  })
  const [result, setResult] = useState<LoadedPage | null>(null)
  const [failure, setFailure] = useState<LoadFailure | null>(null)
  const [industries, setIndustries] = useState<IndustryCount[]>([])
  const [genders, setGenders] = useState<GenderCount[]>([])
  const [races, setRaces] = useState<RaceCount[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  const requestKey = `${request.page}\u0000${request.query}\u0000${request.industry ?? ''}\u0000${request.gender ?? ''}\u0000${request.race ?? ''}\u0000${reloadKey}`
  const loading = !(result?.key === requestKey || failure?.key === requestKey)
  const error = failure?.key === requestKey ? failure.message : null
  const pageData = result?.key === requestKey ? result.data : null
  const lastData = pageData ?? result?.data ?? null
  const total = lastData?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstVisibleRecord = total === 0 ? 0 : (request.page - 1) * PAGE_SIZE + 1
  const lastVisibleRecord = Math.min(request.page * PAGE_SIZE, total)
  const visibleRecords = pageData?.items ?? []
  const hasFilters = Boolean(
    searchInput.trim() || request.industry || request.gender || request.race,
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextQuery = searchInput.trim()
      setRequest((current) =>
        current.query === nextQuery && current.page === 1
          ? current
          : { ...current, query: nextQuery, page: 1 },
      )
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    fetchBusinesses(
      {
        offset: (request.page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
        query: request.query,
        industry: request.industry,
        gender: request.gender,
        race: request.race,
      },
      controller.signal,
    )
      .then((data) => {
        if (!active) {
          return
        }
        setResult({ key: requestKey, data })
        setFailure(null)

        const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE))
        if (request.page > lastPage) {
          setRequest((current) => ({ ...current, page: lastPage }))
        }
      })
      .catch((reason: unknown) => {
        if (!active) {
          return
        }
        if (reason instanceof DOMException && reason.name === 'AbortError') {
          return
        }
        setFailure({
          key: requestKey,
          message: reason instanceof Error ? reason.message : 'Unable to load records.',
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [request, requestKey])

  useEffect(() => {
    const controller = new AbortController()

    fetchIndustries(controller.signal)
      .then(setIndustries)
      .catch(() => {
        // The records table still works when the filter list cannot be loaded.
      })
    fetchGenders(controller.signal)
      .then(setGenders)
      .catch(() => {
        // The records table still works when the filter list cannot be loaded.
      })
    fetchRaces(controller.signal)
      .then(setRaces)
      .catch(() => {
        // The records table still works when the filter list cannot be loaded.
      })

    return () => controller.abort()
  }, [])

  function changePage(nextPage: number) {
    setRequest((current) =>
      current.page === nextPage ? current : { ...current, page: nextPage },
    )
  }

  function selectIndustry(industry: string | null) {
    setRequest((current) =>
      current.industry === industry && current.page === 1
        ? current
        : { ...current, industry, page: 1 },
    )
  }

  function selectGender(gender: string | null) {
    setRequest((current) =>
      current.gender === gender && current.page === 1
        ? current
        : { ...current, gender, page: 1 },
    )
  }

  function selectRace(race: string | null) {
    setRequest((current) =>
      current.race === race && current.page === 1
        ? current
        : { ...current, race, page: 1 },
    )
  }

  function clearFilters() {
    setSearchInput('')
    setRequest((current) =>
      current.query === '' &&
      current.industry === null &&
      current.gender === null &&
      current.race === null &&
      current.page === 1
        ? current
        : { page: 1, query: '', industry: null, gender: null, race: null },
    )
  }

  function clearSearch() {
    setSearchInput('')
    setRequest((current) =>
      current.query === '' && current.page === 1
        ? current
        : { ...current, query: '', page: 1 },
    )
  }

  return (
    <main className="database-page" id="main-content">
      <section className="hero-section" aria-labelledby="database-hero-title">
        <img
          className="hero-section__photo"
          src={databaseHeroPhoto}
          alt="Historic Gainesville street scene from a local archival postcard"
        />
        <div className="hero-section__content">
          <p className="eyebrow">Explore the collection</p>
          <h1 id="database-hero-title">Gainesville Business History Database</h1>
          <p className="hero-section__description">
            Search historical business records by name, owner, address, industry, gender, and race.
          </p>
        </div>
      </section>

      <section className="database-explorer" aria-labelledby="database-explorer-title">
        <div className="database-explorer__heading">
          <div>
            <p className="eyebrow">Public records</p>
            <h2 id="database-explorer-title">Browse the database</h2>
            <p className="database-explorer__description">
              Search live records by business name, owner, address, industry, gender, or race.
            </p>
          </div>
          <p className="database-preview-note">
            {lastData ? `Live database · ${total.toLocaleString()} records` : 'Live database'}
          </p>
        </div>

        <form className="database-search" role="search" onSubmit={(event) => event.preventDefault()}>
          <label htmlFor="database-search-input">Search records</label>
          <div className="database-search__field">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
              <circle cx="10.8" cy="10.8" r="6.8" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              id="database-search-input"
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search business names, owners, addresses, industries, genders, and races"
              autoComplete="off"
            />
            {searchInput && (
              <button type="button" onClick={clearSearch}>
                Clear
              </button>
            )}
          </div>
        </form>

        <FilterButtonGroup
          id="category-filter-title"
          heading="Browse by broad industry"
          ariaLabel="Filter by broad industry"
          options={industries}
          selected={request.industry}
          onSelect={selectIndustry}
        />
        <FilterButtonGroup
          id="gender-filter-title"
          heading="Browse by gender"
          ariaLabel="Filter by gender"
          options={genders}
          selected={request.gender}
          onSelect={selectGender}
        />
        <FilterButtonGroup
          id="race-filter-title"
          heading="Browse by race"
          ariaLabel="Filter by race"
          options={races}
          selected={request.race}
          onSelect={selectRace}
        />

        <div className="database-results__summary" aria-live="polite" aria-atomic="true">
          <p>
            {loading
              ? 'Loading records…'
              : `Showing ${firstVisibleRecord}–${lastVisibleRecord} of ${total.toLocaleString()} results`}
          </p>
          {hasFilters && (
            <button className="database-results__clear" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>

        <div
          className="database-table__scroll"
          role="region"
          aria-label="Business database results"
          tabIndex={0}
        >
          <table className="database-table" aria-busy={loading}>
            <caption className="visually-hidden">Gainesville business records</caption>
            <thead>
              <tr>
                <th scope="col">Business Name</th>
                <th scope="col">Broad Industry</th>
                <th scope="col">Specific Industry</th>
                <th scope="col">Appearance Decade</th>
                <th scope="col">Source Year</th>
                <th scope="col">Owner</th>
                <th scope="col">Race</th>
                <th scope="col">Gender</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td className="database-table__empty" colSpan={8}>
                    {error}{' '}
                    <button
                      className="database-results__clear"
                      type="button"
                      onClick={() => setReloadKey((key) => key + 1)}
                    >
                      Try again
                    </button>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td className="database-table__empty" colSpan={8}>
                    Loading records…
                  </td>
                </tr>
              ) : visibleRecords.length > 0 ? (
                visibleRecords.map((record) => (
                  <tr key={record.id}>
                    <th scope="row">{record.businessName}</th>
                    <td>{record.broadIndustry ?? '—'}</td>
                    <td>{record.specificIndustry ?? '—'}</td>
                    <td>{record.appearanceDecade ?? '—'}</td>
                    <td>{record.sourceYear ?? '—'}</td>
                    <td>{record.ownerName ?? '—'}</td>
                    <td>{record.race ?? '—'}</td>
                    <td>{record.gender ?? '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="database-table__empty" colSpan={8}>
                    No records match this search. Try another keyword.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <nav className="database-pagination" aria-label="Database result pages">
          <button
            type="button"
            onClick={() => changePage(Math.max(1, request.page - 1))}
            disabled={loading || request.page === 1}
          >
            Previous
          </button>
          <p>
            Page <strong>{request.page}</strong> of <strong>{pageCount}</strong>
          </p>
          <button
            type="button"
            onClick={() => changePage(Math.min(pageCount, request.page + 1))}
            disabled={loading || request.page >= pageCount}
          >
            Next
          </button>
        </nav>
      </section>
    </main>
  )
}
