// Declaring a VAR with a flag's name mirrors it: Ink sees the world's value,
// and changing it here changes the world's flag.
VAR power = false
VAR switch_flips = 0

=== breaker_look ===
Wren: An old breaker. It's {power: up|down}.
-> END

=== breaker_use ===
~ power = not power
~ switch_flips = switch_flips + 1
{ power:
    The grow lamps stutter, then hum.
- else:
    Click. The lamps die.
}
{ switch_flips >= 4:
    Moth: Please stop playing with the breaker.
}
-> END

=== planter_look ===
Wren: {power: Seedlings, leaning toward the lamps.|Hard to see anything in this light.}
-> END

=== shelf_look ===
Wren: Too dark to make out.
-> END

=== sprout_look ===
Wren: A sprout that glows faintly under the lamps. Is that normal?
Moth: Nothing in here is normal.
-> END

=== sprout_take ===
Moth: Don't you dare.
-> END

=== moth_look ===
Wren: Moth's eye-lamps are {power: dimmed politely|the brightest thing in here}.
-> END

=== moth_talk ===
{ power:
    Moth: Thank you. Photosynthesis is so much easier with photons.
- else:
    Moth: The breaker's by the skylight. Lamps first, conversation later.
}
-> END
