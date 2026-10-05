// Each knot is a handler. "Name: line" is spoken by the actor with
// that id or name; any other line is narration.

=== planter_look ===
Wren: The soil's cracked like an old circuit board.
-> END

=== planter_use ===
Wren: I push a finger into the soil.
A puff of dust. Nothing else happens.
-> END

=== bench_look ===
Wren: Seed packets, a soldering iron, and a mug that says WORLD'S OKAYEST ROBOT.
-> END

=== moth_look ===
Wren: A gardening robot with dusty felt wings.
Its eye-lamps flicker when it thinks.
-> END

=== moth_talk ===
// moth_talk counts its own visits: 1 the first time.
{ moth_talk == 1:
    Moth: Oh! A visitor. Mind the seedlings.
- else:
    Moth: Back again?
}
- (questions)
// * choices disappear once chosen; + choices stay.
* [What's wrong with the planter?]
    Moth: Dry as a circuit board. Nobody's watered it in weeks.
    -> questions
* [Why the wings?]
    Moth: Pollination. Also, I like them.
    Wren: They suit you.
    -> questions
+ [Who are you?]
    Moth: Greenhouse custodian, model M-07. Friends call me Moth.
    -> questions
+ [Bye.]
    Moth: Mind the seedlings.
    -> END
