// >>> lines run engine commands, in order. Each one finishes
// (an actor arrives, a wait ends) before the next line starts.

=== moth_tour ===
Moth: Allow me to show you around.
>>> stroll wren 6 6
>>> walk moth 4 5
>>> face moth up
Moth: The planter. Sixteen seedlings, all thirsty.
>>> walk moth 13 5
>>> face moth up
Moth: The workbench. Do not touch the soldering iron.
>>> face moth down
>>> wait 600
>>> blink moth 3
Moth: Sorry. Low battery.
>>> walk moth 11 6
>>> face moth left
>>> say wren "That was the whole tour?"
Moth: It's a small greenhouse.
-> END

=== moth_look ===
Wren: A gardening robot with dusty felt wings.
-> END

=== planter_look ===
Wren: Sixteen thirsty seedlings.
-> END

=== bench_look ===
Wren: The soldering iron is still warm.
-> END
