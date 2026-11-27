/**
 * Namele frond — the cycad leaf on the Vanuatu flag and coat of arms, used for
 * Custom Chiefs' Day. lucide has no equivalent; `Crown` was the nearest and
 * reads as European monarchy rather than a nakamal.
 *
 * Follows lucide's conventions so it drops into the same slots: 24x24 viewBox,
 * currentColor stroke, 2px round-capped strokes, `size` prop.
 */
export default function NameleFrond({ size = 24, className = '', ...rest }) {
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
      <path d="M12 21V4" />
      <path d="M12 8 7.5 5.5M12 8l4.5-2.5" />
      <path d="M12 12.5 6.5 9.5M12 12.5l5.5-3" />
      <path d="M12 17 7 14.5M12 17l5-2.5" />
    </svg>
  )
}
