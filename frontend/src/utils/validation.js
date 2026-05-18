export function validateRequired(value, label) {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${label} is required`
  }
  return null
}

export function validateMinLength(value, min, label) {
  if (value && value.length < min) {
    return `${label} must be at least ${min} characters`
  }
  return null
}

export function validateMaxLength(value, max, label) {
  if (value && value.length > max) {
    return `${label} must be at most ${max} characters`
  }
  return null
}

export function validateEmail(value) {
  if (!value) return null
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!re.test(value)) {
    return 'Invalid email address'
  }
  return null
}

export function validateForm(fields) {
  const errors = {}
  for (const [key, validators] of Object.entries(fields)) {
    for (const validator of validators) {
      const err = validator()
      if (err) {
        errors[key] = err
        break
      }
    }
  }
  return errors
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0
}

export function getInputProps(register, fieldName, errors, type = 'text') {
  return {
    id: fieldName,
    name: fieldName,
    type,
    onChange: register ? (e) => register(fieldName, e.target.value) : undefined,
    value: register ? register.values[fieldName] || '' : undefined,
    'aria-invalid': !!errors[fieldName],
    'aria-describedby': errors[fieldName] ? `${fieldName}-error` : undefined,
    className: `w-full rounded-lg border ${errors[fieldName] ? 'border-red-500' : 'border-gray-300'} px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors`,
  }
}
