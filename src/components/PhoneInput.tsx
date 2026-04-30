import { useState, useEffect } from 'react'
import ReactPhoneInput from 'react-phone-number-input'

interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  onCountryChange?: (c: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function PhoneInput({ value, onChange, onCountryChange, disabled, className = '', placeholder }: PhoneInputProps) {
  const [focused, setFocused] = useState(false)
  const [defaultCountry, setDefaultCountry] = useState<any>('GB')

  useEffect(() => {
    try {
      const locale = navigator.language || (navigator as any).userLanguage;
      if (locale) {
        const parts = locale.split('-');
        if (parts.length > 1 && parts[1].length === 2) {
          setDefaultCountry(parts[1].toUpperCase());
        } else if (parts[0].length === 2) {
          setDefaultCountry(parts[0].toUpperCase());
        }
      }
    } catch (e) {}
  }, [])

  return (
    <div
      className={`transition-all flex items-center ${className} ${focused && !disabled ? 'ring-2' : ''} ${disabled ? 'opacity-80 cursor-not-allowed' : ''}`}
    >
      <ReactPhoneInput
        international
        countries={['GB', 'AU', 'DE', 'FR', 'NL', 'PK']}
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
