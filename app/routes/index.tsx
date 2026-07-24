import { createRoute } from 'honox/factory'
import HelloIsland from '../islands/hello-island'

export default createRoute((c) => {
  return c.render(
    <main>
      <h1>DINNER QUEST</h1>
      <HelloIsland />
    </main>,
    { title: 'Dinner Quest' }
  )
})
