=== to_shed ===
>>> sfx door
>>> goto shed door
-> END

=== to_greenhouse ===
>>> sfx door
>>> goto greenhouse from-shed
-> END

=== greenhouse_enter ===
{ greenhouse_enter == 1:
    Click anywhere to start the sound. Then walk through the door on the right.
}
-> END

=== shed_enter ===
{ shed_enter == 1:
    Wren: The music changed. So did the mood.
}
-> END

=== shed_door_look ===
Wren: The potting shed. Notice the music dip while I'm talking?
-> END

=== tools_look ===
>>> sfx chime
Wren: A wind chime, hung on the tool rack.
-> END

=== moth_talk ===
Moth: Allow me.
>>> sfx pour
Moth: I watered the floor. On purpose.
-> END
