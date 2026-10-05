=== to_shed ===
>>> goto shed door
-> END

=== to_greenhouse ===
>>> goto greenhouse from-shed
-> END

// onEnter knots run every time the room is entered (and once at start).
// A knot's name is its visit count, so "== 1" means the first time.
=== greenhouse_enter ===
{ greenhouse_enter == 1:
    Warm, damp air, and the smell of green things.
}
-> END

=== shed_enter ===
{ shed_enter == 1:
    Wren: So this is where Moth hides.
}
-> END

=== shed_door_look ===
Wren: The potting shed. I can hear humming.
-> END

=== tools_look ===
Wren: Trowels, sorted by size. Then by colour. Then by mood?
-> END

=== moth_talk ===
Moth: Visitors in the shed are rare. Visitors anywhere are rare.
-> END
