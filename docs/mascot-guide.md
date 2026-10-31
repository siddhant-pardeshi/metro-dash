# Ziggy — the mascot guide

Ziggy is the rooftop regular who greets you on the menu and reacts to your run. Like every guide on the deck, Ziggy is the shared layered-SVG character rig: a chibi kid in a pale-blue fox hoodie with a gold star charm — recreated from the studio's reference sheet as vector layers (ears, eyes, mouth, arms, tail, head), each animated by a state machine. Nothing is a video or a looping GIF.

## Character invariants

- Pale-blue fox hoodie, cream lining, gold four-point star charm, navy shorts, blue boots, cream-tipped tail — always.
- Wide-set angled fox ears; big brown eyes; soft blush.
- The reference sheet wins over any written description.

## States used in this game

| Trigger | Performance | Line |
| --- | --- | --- |
| First visit | Entrance + wave | "Ziggy! You made the last train… mostly." |
| Return visit | Wave | "Tickets are collected, legs are stretched." |
| Run start | Alert | "Go go go — the gap at Carlson Street opens in ten!" |
| Mission cleared | Cheer | "Mission done! That one pays for dinner." |
| Near-miss | Alert + comment | "CLOSE one! My heart rate spiked for you." |
| 1000 m milestone | Cheer | "Thousand meters! The skyline is yours." |
| Crash | Sad | "Rough landing. The metro waits for no one…" |
| Pause | Sleep (z's) | — |
| Win | Cheer | "What a run — every mission and then some." |

Lines rotate so nothing repeats back-to-back; cooldowns prevent spam during rapid events. The mouth flaps while a bubble is up; bubbles dismiss on tap.

## Where Ziggy lives

Bottom-right dock on desktop, bottom-left on touch, sized down on small screens — never over the track, the mission chips, or the swipe zones. Settings → **Show Ziggy** hides them; reduced motion keeps only slow blinks.

## Replacing the art

The character is one SVG string + one stylesheet in `js/mascot.js`. Keep the element ids (`m-armR`, `m-earL`, `m-eyeL`, `m-mouth`, `m-tail`, `m-charm`…), keep the layer order, swap colors in the palette object, and preview every state via `?mascot=gallery` on any game URL.
