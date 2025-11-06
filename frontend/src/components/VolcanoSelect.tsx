import { useState, useRef, useEffect } from 'react'
import './VolcanoSelect.css'

type VolcanoSelectProps = {
  label: string
  options: string[]
  defaultValue?: string
  onChange?: (value: string) => void
}

export const VolcanoSelect = ({ label, options, defaultValue, onChange }: VolcanoSelectProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(defaultValue || options[0] || '')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleSelect = (value: string) => {
    setSelectedValue(value)
    setIsOpen(false)
    onChange?.(value)
  }

  return (
    <div className="pond-inline-group">
      <label>{label}</label>
      <div ref={containerRef} className="volcano-select-container">
        <button
          type="button"
          className="volcano-select"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
        >
          <span className="volcano-select__value">{selectedValue}</span>
          <span className={`volcano-select__arrow ${isOpen ? 'is-open' : ''}`}>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1.41 0L6 4.58 10.59 0 12 1.41l-6 6-6-6z" fill="currentColor" />
            </svg>
          </span>
        </button>
        {isOpen && (
          <div className="volcano-select__dropdown">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                className={`pond-option ${selectedValue === option ? 'is-selected' : ''}`}
                onClick={() => handleSelect(option)}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
