/**
 * Red beanie — Christmas Day.
 *
 * lucide has no Santa hat, and `Snowflake` would be wrong here: 25 December in
 * Vanuatu is high summer and cyclone season. A beanie reads as Christmas by
 * convention without claiming winter. `Gift` is the neutral alternative.
 *
 * Follows lucide's conventions: 24x24 viewBox, currentColor stroke, 2px
 * round-capped strokes, `size` prop. The pom-pom is filled so it reads at 12px.
 */
export default function Beanie({ size = 24, className = '', ...rest }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...rest}
    >
      <path d="M5 15a7 7 0 0 1 14 0" />
      <path d="M3.5 15h17a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-17a1 1 0 0 1-1-1V16a1 1 0 0 1 1-1z" />
      <circle cx="12" cy="5.4" r="1.6" fill="currentColor" stroke="none" />
      <path d="M12 8v0" />
    </svg>
  )
}
