import { useMemo, useState } from 'react'
import databaseHeroPhoto from '../assets/gainesville-tourist-camp.jpg'
import { sampleDatabaseRecords } from '../data/databaseRecords'

export default function DatabasePage() {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredRecords = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase()
    if (!query) return sampleDatabaseRecords

    return sampleDatabaseRecords.filter((record) =>
      Object.values(record).some((value) => value.toLocaleLowerCase().includes(query)),
    )
  }, [searchTerm])

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
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search business names, industries, years, and more"
              autoComplete="off"
            />
            {searchTerm && (
              <button type="button" onClick={() => setSearchTerm('')}>
                Clear
              </button>
            )}
          </div>
        </form>

        <div className="database-results__summary" aria-live="polite">
          <p>
            {filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'}
          </p>
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
              {filteredRecords.length > 0 ? (
                filteredRecords.map((record) => (
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
      </section>
    </main>
  )
}
