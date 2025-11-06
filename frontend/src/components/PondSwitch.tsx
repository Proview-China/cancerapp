import { useState } from 'react'
import './PondSwitch.css'

type PondSwitchProps = {
  label: string
  defaultChecked?: boolean
  onChange?: (checked: boolean) => void
}

export const PondSwitch = ({ label, defaultChecked = false, onChange }: PondSwitchProps) => {
  const [checked, setChecked] = useState(defaultChecked)

  const handleToggle = () => {
    const newValue = !checked
    setChecked(newValue)
    onChange?.(newValue)
  }

  return (
    <div className="pond-switch-wrapper">
      <span className="pond-switch-label">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        className={['pond-switch', checked ? 'is-checked' : ''].join(' ').trim()}
        onClick={handleToggle}
      >
        <span className="pond-switch__track">
          <span className="pond-switch__thumb" />
        </span>
      </button>
    </div>
  )
}
