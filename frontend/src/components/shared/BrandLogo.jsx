/**
 * BrandLogo — navy rounded square with the SCDMS white icon inside.
 * Used in the Login top bar, Sidebar header, and anywhere a "app icon" style
 * brand mark is needed.
 *
 * Props:
 *   size  – outer box size in px (default 36)
 */
const logoUrl = `url(${import.meta.env.BASE_URL}logo.svg)`

export default function BrandLogo({ size = 36 }) {
  const radius = Math.round(size * 0.22)          // ~22 % corner radius
  const iconSize = Math.round(size * 0.62)         // icon fills ~62 % of box

  return (
    <div
      style={{
        width:           size,
        height:          size,
        minWidth:        size,
        backgroundColor: '#0c2451',
        borderRadius:    radius,
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        flexShrink:      0,
      }}
    >
      <div
        style={{
          width:                  iconSize,
          height:                 iconSize,
          backgroundColor:        'white',
          WebkitMaskImage:        logoUrl,
          WebkitMaskSize:         'contain',
          WebkitMaskRepeat:       'no-repeat',
          WebkitMaskPosition:     'center',
          maskImage:              logoUrl,
          maskSize:               'contain',
          maskRepeat:             'no-repeat',
          maskPosition:           'center',
        }}
      />
    </div>
  )
}
