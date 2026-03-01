import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../services/api'
import './AddressSearch.css'

const DEBOUNCE_MS = 300

function AddressSearch({ id, value, onChange, placeholder }) {
  const [query, setQuery] = useState(value || '')
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const containerRef = useRef(null)

  // Keep text input in sync if parent clears the value
  useEffect(() => {
    if (value === '' && query !== '') {
      setQuery('')
      setSuggestions([])
    }
  }, [value])

  function handleInputChange(event) {
    const text = event.target.value
    setQuery(text)
    setActiveIndex(-1)

    // Notify parent that a plain text value is being typed (not yet selected)
    onChange({ displayName: text, lat: null, lng: null })

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (text.trim().length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await apiRequest(`/geocode/search?q=${encodeURIComponent(text.trim())}&limit=5`)
        setSuggestions(results)
        setOpen(results.length > 0)
      } catch (_err) {
        setSuggestions([])
        setOpen(false)
      } finally {
        setLoading(false)
      }
    }, DEBOUNCE_MS)
  }

  function handleSelect(suggestion) {
    setQuery(suggestion.displayName)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
    onChange({
      displayName: suggestion.displayName,
      lat: suggestion.lat,
      lng: suggestion.lng,
    })
  }

  function handleKeyDown(event) {
    if (!open || suggestions.length === 0) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1))
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      handleSelect(suggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="address-search" ref={containerRef}>
      <input
        id={id}
        type="text"
        value={query}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder={placeholder || 'Search for an address...'}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${id}-listbox`}
        aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
      />

      {loading && <span className="address-search-loading" aria-hidden="true" />}

      {open && suggestions.length > 0 && (
        <ul
          className="address-search-dropdown"
          id={`${id}-listbox`}
          role="listbox"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.lat}-${suggestion.lng}-${index}`}
              id={`${id}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className={`address-search-option ${index === activeIndex ? 'address-search-option-active' : ''}`}
              onMouseDown={() => handleSelect(suggestion)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="address-search-option-name">{suggestion.displayName}</span>
              {suggestion.type && (
                <span className="address-search-option-type">{suggestion.type}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default AddressSearch
