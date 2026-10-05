```ts
export const greenhouse = defineRoom({
  id: "greenhouse",
  projection: "orthogonal", // or "isometric"
  tile: { width: 16, height: 16 },
  walkmap: [
    "##########",
    "#........#",
    "#..##....#",
    "#........#",
    "##########",
  ],
  hotspots: [{
    id: "planter",
    name: "dry planter",
    shape: tileArea(base, 3, 2, 2, 1, 6),
    standAt: { x: 3, y: 3 },
    verbs: { look: "planter_look", use: "planter_use" },
  }],
});
```
