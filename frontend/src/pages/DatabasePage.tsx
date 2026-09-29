import { useMemo, useState } from 'react'
import databaseHeroPhoto from '../assets/gainesville-tourist-camp.jpg'
import {
  databaseCategories,
  sampleDatabaseRecords,
  type DatabaseCategory,
} from '../data/databaseRecords'

const pageSize = 5

export default function DatabasePage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<DatabaseCategory | 'All'>('All')
  const [currentPage, setCurrentPage] = useState(1)

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase()

    return sampleDatabaseRecords.filter((record) => {
      const matchesCategory = selectedCategory === 'All' || record.category === selectedCategory
      const matchesSearch =
        !query || Object.values(record).some((value) => value.toLocaleLowerCase().includes(query))

      return matchesCategory && matchesSearch
    })
  }, [searchTerm, selectedCategory])

  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  const firstVisibleRecord = filteredRecords.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const lastVisibleRecord = Math.min(currentPage * pageSize, filteredRecords.length)
  const visibleRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  function clearFilters() {
    setSearchTerm('')
    setSelectedCategory('All')
    setCurrentPage(1)
  }

  function selectCategory(category: DatabaseCategory | 'All') {
    setSelectedCategory(category)
    setCurrentPage(1)
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
            Search historical business records by name, industry, decade, and source year.
          </p>
        </div>
      </section>

      <section className="database-explorer" aria-labelledby="database-explorer-title">
        <div className="database-explorer__heading">
          <div>
            <p className="eyebrow">Public records</p>
            <h2 id="database-explorer-title">Browse the database</h2>
            <p className="database-explorer__description">
              Search sample records or select a category to narrow the results.
            </p>
          </div>
          <p className="database-preview-note">Preview data · not connected to the live database</p>
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
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value)
                setCurrentPage(1)
              }}
              placeholder="Search business names, industries, years, and more"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('')
                  setCurrentPage(1)
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>

        <section className="database-category-filters" aria-labelledby="category-filter-title">
          <h3 id="category-filter-title">Browse by category</h3>
          <div className="database-category-filters__buttons" role="group" aria-label="Filter by category">
            {(['All', ...databaseCategories] as const).map((category) => (
              <button
                className={`database-category-button${selectedCategory === category ? ' database-category-button--active' : ''}`}
                key={category}
                type="button"
                aria-pressed={selectedCategory === category}
                onClick={() => selectCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </section>

        <div className="database-results__summary" aria-live="polite" aria-atomic="true">
          <p>
            Showing {firstVisibleRecord}–{lastVisibleRecord} of {filteredRecords.length} results
          </p>
          {(searchTerm || selectedCategory !== 'All') && (
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
          <table className="database-table">
            <caption className="visually-hidden">Sample Gainesville business records</caption>
            <thead>
              <tr>
                <th scope="col">Business Name</th>
                <th scope="col">Broad Industry</th>
                <th scope="col">Specific Industry</th>
                <th scope="col">Appearance Decade</th>
                <th scope="col">Appearance Decade (Computed)</th>
                <th scope="col">Source Year</th>
                <th scope="col">Race</th>
                <th scope="col">Gender</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.length > 0 ? (
                visibleRecords.map((record) => (
                  <tr key={record.id}>
                    <th scope="row">{record.businessName}</th>
                    <td>{record.broadIndustry}</td>
                    <td>{record.specificIndustry}</td>
                    <td>{record.appearanceDecade}</td>
                    <td>{record.computedDecade}</td>
                    <td>{record.sourceYear}</td>
                    <td>{record.race}</td>
                    <td>{record.gender}</td>
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
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          <p>
            Page <strong>{currentPage}</strong> of <strong>{pageCount}</strong>
          </p>
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(pageCount, page + 1))}
            disabled={currentPage === pageCount}
          >
            Next
          </button>
        </nav>
      </section>
    </main>
  )
}
