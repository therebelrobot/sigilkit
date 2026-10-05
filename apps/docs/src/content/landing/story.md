```ink
VAR planter_watered = false

=== planter_look ===
{ planter_watered:
    Wren: Something green is curling up.
- else:
    Wren: The soil's cracked like an old circuit board.
}
-> END

=== planter_water ===
>>> sfx pour
~ planter_watered = true
Wren: There you go.
>>> walk wren 6 3
Moth: They'll open by noon.
-> END
```
