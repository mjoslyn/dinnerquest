import { useState } from 'hono/jsx'

export default function HelloIsland() {
  const [count, setCount] = useState(0)
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      Hydrated: {count}
    </button>
  )
}
