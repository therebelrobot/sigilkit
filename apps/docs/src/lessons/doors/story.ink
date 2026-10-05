VAR gate_open = true

=== gate_use ===
~ gate_open = not gate_open
{ gate_open:
    The gate grinds open.
- else:
    The gate slams shut.
}
-> END

=== gate_look ===
Wren: An iron gate. It's {gate_open: open|shut}.
-> END

=== moth_look ===
Wren: Moth's on patrol. Moth takes patrol very seriously.
-> END
