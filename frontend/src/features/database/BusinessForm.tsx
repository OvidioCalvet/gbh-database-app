import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import {
  BusinessesApiError,
  createBusiness,
  updateBusiness,
  type BusinessDetail,
  type BusinessWriteInput,
} from './businessesApi'
import {
  detailToFormValues,
  emptyFormValues,
  type FormValues,
} from './businessFormValues'

type InputKind = 'text' | 'number' | 'url' | 'textarea' | 'boolean' | 'closed'

interface FieldDefinition {
  key: keyof FormValues
  label: string
  kind: InputKind
  placeholder?: string
  hint?: string
  min?: number
  max?: number
  step?: number
  fullWidth?: boolean
}

interface FieldGroup {
  legend: string
  description?: string
  fields: FieldDefinition[]
}

const fieldGroups: FieldGroup[] = [
  {
    legend: 'Business identity',
    fields: [
      {
        key: 'businessName',
        label: 'Business name',
        kind: 'text',
        placeholder: 'Johnson Brothers',
      },
      {
        key: 'bizId',
        label: 'Business ID',
        kind: 'text',
        placeholder: 'Generated automatically when left blank',
        hint: 'The existing CSV IDs look like BIZ_D8B8C78BAE90.',
      },
      {
        key: 'broadIndustry',
        label: 'Broad industry',
        kind: 'text',
        placeholder: 'Food Industry and Trade',
      },
      {
        key: 'specificIndustry',
        label: 'Specific industry',
        kind: 'text',
        placeholder: 'Groceries',
      },
    ],
  },
  {
    legend: 'Dates and status',
    fields: [
      { key: 'sourceYear', label: 'Source year', kind: 'number', min: 1800, max: 2100 },
      {
        key: 'foundingYear',
        label: 'Founding year',
        kind: 'number',
        min: 1800,
        max: 2100,
      },
      {
        key: 'firstAppearance',
        label: 'First appearance',
        kind: 'number',
        min: 1800,
        max: 2100,
      },
      {
        key: 'endYear',
        label: 'End year',
        kind: 'number',
        min: 1800,
        max: 2100,
      },
      {
        key: 'appearanceDecade',
        label: 'Appearance decade',
        kind: 'text',
        placeholder: '1950s',
        hint: 'Use four digits followed by “s”, for example 1950s.',
      },
      { key: 'ifClosed', label: 'Business status', kind: 'closed' },
    ],
  },
  {
    legend: 'People and ownership',
    fields: [
      { key: 'ownerName', label: 'Owner name', kind: 'text' },
      { key: 'race', label: 'Race', kind: 'text', placeholder: 'Black, White, Asian…' },
      { key: 'gender', label: 'Gender', kind: 'text', placeholder: 'Male, Female…' },
      { key: 'ownershipType', label: 'Ownership type', kind: 'text' },
      {
        key: 'ownershipDemographic',
        label: 'Ownership demographic',
        kind: 'text',
      },
    ],
  },
  {
    legend: 'Location and contact',
    fields: [
      {
        key: 'address',
        label: 'Address',
        kind: 'text',
        placeholder: '608 SW 4th Ave, Gainesville, Florida',
        fullWidth: true,
      },
      { key: 'oldAddress', label: 'Old address', kind: 'text', fullWidth: true },
      {
        key: 'postal',
        label: 'Postal code',
        kind: 'text',
        placeholder: '32601',
        hint: 'Five digits.',
      },
      { key: 'phoneNumber', label: 'Phone number', kind: 'text' },
      {
        key: 'pointX',
        label: 'Longitude (POINT_X)',
        kind: 'number',
        min: -180,
        max: 180,
        step: 0.00000001,
      },
      {
        key: 'pointY',
        label: 'Latitude (POINT_Y)',
        kind: 'number',
        min: -90,
        max: 90,
        step: 0.00000001,
      },
      {
        key: 'website',
        label: 'Website',
        kind: 'url',
        placeholder: 'https://example.com',
        fullWidth: true,
      },
      { key: 'socialMedia', label: 'Has social media', kind: 'boolean' },
    ],
  },
  {
    legend: 'Social and archival links',
    description: 'Enter full links that start with http:// or https://.',
    fields: [
      { key: 'facebookUrl', label: 'Facebook URL', kind: 'url' },
      { key: 'instagramUrl', label: 'Instagram URL', kind: 'url' },
      { key: 'youtubeUrl', label: 'YouTube URL', kind: 'url' },
      { key: 'xUrl', label: 'X URL', kind: 'url' },
      { key: 'linkedinUrl', label: 'LinkedIn URL', kind: 'url' },
      { key: 'linkOhInterview', label: 'Oral history interview', kind: 'url' },
      { key: 'linkGbhStory', label: 'GBH story', kind: 'url' },
    ],
  },
  {
    legend: 'Sources and notes',
    fields: [
      { key: 'sourceId', label: 'Source ID', kind: 'text' },
      { key: 'newspaper', label: 'Newspaper', kind: 'text' },
      { key: 'cityDirectories', label: 'In city directories', kind: 'boolean' },
      {
        key: 'googleModernBusiness',
        label: 'Google modern business',
        kind: 'boolean',
      },
      {
        key: 'notes',
        label: 'Notes',
        kind: 'textarea',
        placeholder: 'Research notes, source context, or follow-up details.',
        fullWidth: true,
      },
    ],
  },
]

const yearFields: (keyof FormValues)[] = [
  'sourceYear',
  'foundingYear',
  'firstAppearance',
  'endYear',
]

const urlFields: (keyof FormValues)[] = [
  'website',
  'facebookUrl',
  'instagramUrl',
  'youtubeUrl',
  'xUrl',
  'linkedinUrl',
  'linkOhInterview',
  'linkGbhStory',
]

function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {}

  if (!values.businessName.trim()) {
    errors.businessName = 'Enter a business name.'
  }

  for (const field of yearFields) {
    const raw = values[field].trim()
    if (!raw) continue
    const year = Number(raw)
    if (!Number.isInteger(year) || year < 1800 || year > 2100) {
      errors[field] = 'Use a four-digit year between 1800 and 2100.'
    }
  }

  if (values.appearanceDecade.trim() && !/^\d{4}s$/.test(values.appearanceDecade.trim())) {
    errors.appearanceDecade = 'Use a decade such as 1950s.'
  }

  if (values.postal.trim() && !/^\d{5}$/.test(values.postal.trim())) {
    errors.postal = 'Enter a five-digit postal code.'
  }

  if (values.pointX.trim()) {
    const longitude = Number(values.pointX)
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.pointX = 'Longitude must be between -180 and 180.'
    }
  }

  if (values.pointY.trim()) {
    const latitude = Number(values.pointY)
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.pointY = 'Latitude must be between -90 and 90.'
    }
  }

  for (const field of urlFields) {
    const raw = values[field].trim()
    if (raw && !/^https?:\/\//i.test(raw)) {
      errors[field] = 'Start the link with http:// or https://.'
    }
  }

  return errors
}

function optionalText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim()
  return trimmed ? Number(trimmed) : null
}

function optionalFlag(value: string): boolean | null {
  if (value === '') return null
  return value === 'true'
}

function toWriteInput(values: FormValues): BusinessWriteInput {
  return {
    bizId: optionalText(values.bizId),
    businessName: values.businessName.trim(),
    sourceYear: optionalNumber(values.sourceYear),
    foundingYear: optionalNumber(values.foundingYear),
    firstAppearance: optionalNumber(values.firstAppearance),
    appearanceDecade: optionalText(values.appearanceDecade),
    endYear: optionalNumber(values.endYear),
    ifClosed: optionalFlag(values.ifClosed),
    broadIndustry: optionalText(values.broadIndustry),
    specificIndustry: optionalText(values.specificIndustry),
    race: optionalText(values.race),
    gender: optionalText(values.gender),
    ownerName: optionalText(values.ownerName),
    ownershipType: optionalText(values.ownershipType),
    ownershipDemographic: optionalText(values.ownershipDemographic),
    address: optionalText(values.address),
    postal: optionalText(values.postal),
    pointX: optionalNumber(values.pointX),
    pointY: optionalNumber(values.pointY),
    oldAddress: optionalText(values.oldAddress),
    phoneNumber: optionalText(values.phoneNumber),
    website: optionalText(values.website),
    socialMedia: optionalFlag(values.socialMedia),
    facebookUrl: optionalText(values.facebookUrl),
    instagramUrl: optionalText(values.instagramUrl),
    youtubeUrl: optionalText(values.youtubeUrl),
    xUrl: optionalText(values.xUrl),
    linkedinUrl: optionalText(values.linkedinUrl),
    sourceId: optionalText(values.sourceId),
    newspaper: optionalText(values.newspaper),
    cityDirectories: optionalFlag(values.cityDirectories),
    googleModernBusiness: optionalFlag(values.googleModernBusiness),
    linkOhInterview: optionalText(values.linkOhInterview),
    linkGbhStory: optionalText(values.linkGbhStory),
    notes: optionalText(values.notes),
  }
}

function describeError(error: unknown): string {
  if (error instanceof BusinessesApiError) {
    if (error.status === 401) {
      return 'Your session has expired. Sign in again to save changes.'
    }
    if (error.status === 403) {
      return 'This browser origin is not allowed to save records.'
    }
    if (error.status === 409) {
      return 'This record was changed by someone else since you opened it. Your changes were not saved.'
    }
    return error.message
  }

  return 'The record could not be saved. Check your connection and try again.'
}

interface BusinessFormProps {
  mode: 'create' | 'edit'
  initialValues?: FormValues
  recordId?: number
  version?: number
  onSaved?: (detail: BusinessDetail) => void
  onCancel?: () => void
  onReload?: () => void
}

export default function BusinessForm({
  mode,
  initialValues = emptyFormValues,
  recordId,
  version,
  onSaved,
  onCancel,
  onReload,
}: BusinessFormProps) {
  const [values, setValues] = useState<FormValues>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')
  const [conflict, setConflict] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formId = useId()

  function setField(key: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setSuccess('')
    setConflict(false)

    if (mode === 'edit' && version === undefined) {
      setFormError('This record could not be checked for recent changes. Reload it and try again.')
      return
    }

    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      setFormError('Fix the highlighted fields before saving.')
      return
    }

    setIsSubmitting(true)
    try {
      const input = toWriteInput(values)
      const saved =
        mode === 'create'
          ? await createBusiness(input)
          : await updateBusiness(recordId ?? 0, {
              ...input,
              expectedVersion: version ?? 0,
            })

      if (mode === 'create') {
        setValues(emptyFormValues)
        setSuccess(`Record created with ID ${saved.bizId}.`)
      } else {
        setValues(detailToFormValues(saved))
        setSuccess('Changes saved.')
      }

      setErrors({})
      onSaved?.(saved)
    } catch (error) {
      if (error instanceof BusinessesApiError && error.status === 409) {
        setConflict(true)
      }
      setFormError(describeError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="record-form" onSubmit={handleSubmit} noValidate>
      {formError && (
        <p className="record-form__alert" role="alert">
          {formError}
        </p>
      )}
      {conflict && onReload && (
        <div className="record-form__conflict">
          <button
            className="record-form__secondary"
            type="button"
            onClick={onReload}
          >
            Discard my changes and reload
          </button>
        </div>
      )}
      {success && (
        <p className="record-form__success" role="status">
          {success}
        </p>
      )}

      {fieldGroups.map((group) => (
        <fieldset className="record-form__group" key={group.legend}>
          <legend>{group.legend}</legend>
          {group.description && (
            <p className="record-form__group-description">{group.description}</p>
          )}
          <div className="record-form__grid">
            {group.fields.map((field) => {
              const inputId = `${formId}-${field.key}`
              const hintId = `${inputId}-hint`
              const errorId = `${inputId}-error`
              const fieldError = errors[field.key]
              const describedBy =
                [field.hint ? hintId : null, fieldError ? errorId : null]
                  .filter(Boolean)
                  .join(' ') || undefined

              return (
                <div
                  className={`record-form__field${field.fullWidth ? ' record-form__field--wide' : ''}`}
                  key={field.key}
                >
                  <label htmlFor={inputId}>
                    {field.label}
                    {field.key === 'businessName' && (
                      <span className="record-form__required"> (required)</span>
                    )}
                  </label>

                  {field.kind === 'textarea' ? (
                    <textarea
                      id={inputId}
                      value={values[field.key]}
                      onChange={(event) => setField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      rows={4}
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={describedBy}
                    />
                  ) : field.kind === 'boolean' || field.kind === 'closed' ? (
                    <select
                      id={inputId}
                      value={values[field.key]}
                      onChange={(event) => setField(field.key, event.target.value)}
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={describedBy}
                    >
                      <option value="">Unknown</option>
                      {field.kind === 'closed' ? (
                        <>
                          <option value="false">Open</option>
                          <option value="true">Closed</option>
                        </>
                      ) : (
                        <>
                          <option value="true">Yes</option>
                          <option value="false">No</option>
                        </>
                      )}
                    </select>
                  ) : (
                    <input
                      id={inputId}
                      type={field.kind}
                      value={values[field.key]}
                      onChange={(event) => setField(field.key, event.target.value)}
                      placeholder={field.placeholder}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      inputMode={field.kind === 'number' ? 'decimal' : undefined}
                      autoComplete="off"
                      aria-invalid={Boolean(fieldError)}
                      aria-describedby={describedBy}
                    />
                  )}

                  {field.hint && (
                    <p className="record-form__hint" id={hintId}>
                      {field.hint}
                    </p>
                  )}
                  {fieldError && (
                    <p className="record-form__field-error" id={errorId}>
                      {fieldError}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </fieldset>
      ))}

      <div className="record-form__actions">
        <button className="record-form__submit" type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving…'
            : mode === 'create'
              ? 'Add record'
              : 'Save changes'}
        </button>
        {mode === 'create' ? (
          <button
            className="record-form__secondary"
            type="button"
            disabled={isSubmitting}
            onClick={() => {
              setValues(emptyFormValues)
              setErrors({})
              setFormError('')
              setSuccess('')
            }}
          >
            Clear form
          </button>
        ) : (
          onCancel && (
            <button
              className="record-form__secondary"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            >
              Back to results
            </button>
          )
        )}
      </div>
    </form>
  )
}
