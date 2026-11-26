import useCountUp from '../../hooks/useCountUp'

/** Renders a figure that counts up from zero once. Non-numeric values render as given. */
export default function CountUp({ value }) {
  const shown = useCountUp(value)
  return <>{shown}</>
}
