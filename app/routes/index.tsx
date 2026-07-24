import { createRoute } from 'honox/factory'
import CreateGameForm from '../islands/create-game-form'

export default createRoute((c) => {
  return c.render(
    <>
      <div class="panel">
        <div class="panel-title">START A QUEST</div>
        <CreateGameForm />
      </div>
      <div class="narrative">
        <p>Two players. One week of dinners to secure.</p>
        <p>
          Draft your favorites — meals you <span class="highlight">both</span> pick lock in as
          harmonies. Keep drafting each round until the menu is complete.
        </p>
      </div>
    </>,
    { title: 'DINNER QUEST - A Meal Planning Roguelike' }
  )
})
