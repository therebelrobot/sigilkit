```tsx
const world = new World(game);
new InkRunner(world, story);
world.start();
startGamepad(world);

export const App = () => (
  <GameProvider world={world}>
    <GameShell
      stage={<Stage actors={() => placeholderActor(0xf3d27a)} />}
    />
  </GameProvider>
);
```
