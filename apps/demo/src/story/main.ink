// Story for the demo. Knot names are the strings in game.ts `verbs`.
// Conventions (see sigilkit/story):
//   Name: line      -> spoken by the actor whose id or name matches
//   >>> command     -> engine command, awaited (walk, face, give, goto, sfx, ...)
//   plain line      -> narration
// Globals declared here mirror world flags both ways.

VAR planter_watered = false
VAR annex_door_open = false
VAR took_can = false
VAR roof_unlocked = false
VAR met_moth = false

EXTERNAL has_item(id)
EXTERNAL flag(name)

=== door_look ===
Wren: A door up to the roof. Sunlight leaks around the frame.
-> END

=== door_walk ===
{ roof_unlocked:
    >>> sfx door
    >>> goto rooftop hatch
- else:
    Wren: Moth said not to go up until the seedlings are seen to.
}
-> END

=== planter_look ===
{ planter_watered:
    Wren: Dark, damp soil. Something green is already curling up out of it.
- else:
    Wren: The soil's cracked like an old circuit board.
}
-> END

=== planter_use ===
{ planter_watered:
    Wren: It's had plenty.
- else:
    Wren: I need something to water it with.
}
-> END

=== planter_take ===
Moth: Hands off the seedlings, please.
-> END

=== planter_water ===
{ planter_watered:
    Wren: Any more and they'll drown.
    -> END
}
>>> sfx pour
~ planter_watered = true
Wren: There you go.
The soil darkens. Somewhere under it, something stirs.
-> END

=== can_look ===
Wren: A dented copper watering can. Half full.
-> END

=== can_take ===
>>> give can
~ took_can = true
Wren: I'll borrow this.
-> END

=== bench_look ===
Wren: Seed packets, a soldering iron, and a mug that says WORLD'S OKAYEST ROBOT.
-> END

=== moth_look ===
Wren: A gardening robot with dusty felt wings. Its eye-lamps flicker when it thinks.
-> END

=== moth_talk ===
{ not met_moth:
    ~ met_moth = true
    Moth: Oh! A visitor. Mind the seedlings.
- else:
    Moth: Back again?
}
- (opts)
* { not planter_watered } [What's wrong with the planter?]
    Moth: Dry as a circuit board. The can's on the bench.
    -> opts
+ [Who are you?]
    Moth: Greenhouse custodian, model M-07. Friends call me Moth.
    -> opts
* { planter_watered } [The planter's watered.]
    Moth: Then they'll open by noon. Go see the roof. The panels hum when it's sunny.
    ~ roof_unlocked = true
    -> opts
+ [Bye.]
    Moth: Mind the seedlings.
    -> END

=== rooftop_enter ===
{ rooftop_enter == 1:
    Wind, warm silicon, and the smell of rain somewhere far off.
}
-> END

=== panels_look ===
Wren: They're humming. Moth was right.
-> END

=== panels_use ===
>>> face wren up
Wren: I'd better not touch anything with a voltage I can hear.
-> END

=== box_look ===
Wren: An empty planter box. Waiting for someone.
-> END

=== box_water ===
Wren: Nothing planted yet. Next time.
-> END

=== hatch_look ===
Wren: Back down to the greenhouse.
-> END

=== hatch_walk ===
>>> goto greenhouse door
-> END

// ---------------------------------------------------------------- watchtower

=== walkway_look ===
Wren: A plank walkway out to the old watchtower.
-> END

=== walkway_walk ===
>>> goto watchtower path
-> END

=== watchtower_leave ===
>>> goto rooftop hatch
-> END

=== watchtower_path_look ===
Wren: Back toward the roof garden.
-> END

=== store_enter ===
{ store_enter == 1:
    Wren: A storeroom. Someone left a lantern burning.
}
-> END

=== lantern_look ===
Wren: Still warm. Whoever lit it isn't far.
-> END

=== telescope_look ===
Wren: Pointed at the hills. Somebody's been watching for something.
-> END

=== annex_door_look ===
Wren: A heavy door. The bolt's on this side.
-> END

=== annex_door_use ===
Wren: Let's see what's through here.
~ annex_door_open = true
-> END
