import { useState } from 'react'
import ReactPhoneInput from 'react-phone-number-input'

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  onCountryChange?: (c: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  defaultCountry?: any;
}

export function PhoneInput({ value, onChange, onCountryChange, disabled, className = '', placeholder, defaultCountry = 'GB' }: PhoneInputProps) {
  const [focused, setFocused] = useState(false)

  return (
    <div
      className={`transition-all flex items-center ${className} ${focused && !disabled ? 'ring-2' : ''} ${disabled ? 'opacity-80 cursor-not-allowed' : ''}`}
    >
      <ReactPhoneInput
        international
        countries={['GB', 'DE', 'FR', 'NL']}
        defaultCountry={defaultCountry}
        value={value}
        onChange={(v) => onChange(v || '')}
        onCountryChange={onCountryChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full flex items-center"
      />
    </div>
  )
}
