// VARs with the same name as a world flag stay in sync with it, both ways.
VAR took_can = false
VAR planter_watered = false

// Functions the engine provides, declared so the Ink compiler knows them.
EXTERNAL has_item(id)

=== can_look ===
Wren: A dented copper watering can. Half full.
-> END

=== can_take ===
>>> give can
~ took_can = true
Wren: I'll borrow this.
-> END

=== bench_look ===
{ has_item("can"):
    Wren: Trowels, twine, and a ring where the can used to be.
- else:
    Wren: Trowels, twine, and a watering can.
}
-> END

=== planter_look ===
{ planter_watered:
    Wren: Dark, damp soil. Something green is curling up out of it.
- else:
    Wren: The soil's cracked like an old circuit board.
}
-> END

=== planter_use ===
Wren: I need something to water it with.
-> END

// Runs for "use watering can with dry planter".
=== planter_water ===
{ planter_watered:
    Wren: Any more and they'll drown.
    -> END
}
~ planter_watered = true
Wren: There you go.
The soil darkens. Somewhere under it, something stirs.
-> END

=== moth_water ===
Moth: I am waterproof to a depth of one metre. Please do not test this.
-> END

=== moth_look ===
Wren: A gardening robot with dusty felt wings.
-> END

=== moth_talk ===
{ planter_watered:
    Moth: You watered them! They'll open by noon.
- else:
    Moth: The planter's thirsty. There's a can on the bench.
}
-> END
