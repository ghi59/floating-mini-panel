# Floating Mini Panel GNOME Shell Extension

## Introduction

 ![Screenshot from 20240928 182100](img/Floating-Mini-Panel-Dark.png?msec=1751949159799) ![](img/Floating-Mini-Panel-Light.png?msec=1751949159799)

Floating Mini Panel replaces the Gnome Main Panel with a movable and always-on-top`Mini Panel` with just the DateMenu and QuickSettings. Both menus are fully functional and behave like expected. The `Mini Panel`can be moved anywhere on the desktop by dragging it with the handle button. It will align itself, when dragged over screen edges. A click on the handle button will show AppGrid together with the Gnome Main Panel. To reach obscured window or desktop elements it can be hidden for 5 seconds by right clicking the handle button, or simply moved out of the way.

---

## Features

- Auto Mode <mark>(new)</mark>
  
- Respects Dark / Light mode.
  
- Relies on system settings for date format and battery percentage.
  
- Multi monitor capable.
  
- Relocates itself if necessary when monitors change.
  
- Works on X11 and Wayland.
  
- Integrated to QuickSettings menu.
  
- No extension settings necessary.
  

---

## Installation

Get the latest release from [GNOME Extensions](https://extensions.gnome.org/extension/8274/floating-mini-panel/)

---

## Motivation

Working most of the time with Laptops, every inch of display space is important. Hiding the Main Panel or going into Fullscreen are ways to gain space. But then Intelli-Hide-Features may disturb or Fullscreen has to be toggled. With the `Mini Panel` nothing of this is needed for working maximized, staying informed about time and system status and having important functions available.

---

### Usage

Simply enable Floating Mini Panel via QuickSettings menu and place it where you prefer.

There are two modes of operation, which you can activate in the QuickToggle menu of the `Mini Panel` in QuickSettings. Selecting a mode will automatically enable the `Mini Panel` if it was disabled.

1. Permanent Mode: If permant mode is enabled, the Main Panel will be permanetly (with the exception of Overview) hidden and the `Mini Panel` shown instead.
  
2. Automatic Mode: In automatic mode the `Mini Panel` will only be shown, if the Main Panel is hidden. There are several ways to hide the Main Panel:
  
  | 3rd Party Extension | Actions | Settings |
  | --- | --- | --- |
  | w/o | Fullscreen (F11) | w/o |
  | PaperWM | Switch workspaces | Hide Top Panel per workspace |
  | Hide Top Bar | - Dodge window to Main Panel<br/>- Maximze window<br/>- Fullscreen (F11)<br/>- Reveal/Hide Main Panel | Intelli-Hide |
  | Dash To Panel | - Dodge window to Main Panel<br/>- Maximze window<br/>- Fullscreen (F11)<br/>- Reveal/Hide Main Panel | Intelli-Hide |

**Tip**: To disable the revealing of Main Panel by mouse, disable `Show panel when mouse approaches edge of screen` for 'Hide Top Bar' and/or set  `Required pressure threshold (px)`to `9990` for 'Dash To Panel'.

---

### Coding

This extension mainly relies on <u>Property Bindings</u> and <u>Signals</u>. Neither <u>deprecated functions</u> nor <u>code injections</u> are used. Further it is not very intrusive into the GNOME Shell code respective into the running system.

1. What is changed in all modes:
  
   - The `Mini Panel` is added (TopChrome) to the system.
    
   - Unredirection is disabled.
    
   - Custom Hotkey Handlers for DateMenu and Quicksettings menus.
    
   - SourceActor for DateMenu and Quicksettings menus.
    
   - ArrowAlignment for DateMenu and Quicksettings menus.
    
   - Bottom padding for menus (globally via CSS).

    
2. What is changed additionally in permanent mode:
  
   - PanelBox is moved out of the visible screen area and vice versa.
    
   - Panel is hidden respectively shown.

    
3. What is changed additionally in automatic mode:
  
   - Nothing.

---

### Future Enhancements

| Feature | Status |
| --- | --- |
| Stand-alone Automatic Mode (w/o 3rd party extensions) | planned |
| Present 3rd party indicators (Bartender Style MacOS) | Coding ongoing, prototyp finished |
| Favorites menu via middle click on handle button | Not neccessary anymore, if 3rd party indicators are available in `Mini Panel`  |
| QuickSettings scroll actions (Volume, Caffeine, etc) | Coding finished, Testing ongoing, available in Version 4 |
| Theming (Icon- & Font-Size, Spacing, etc.) | open |

---

### Known Problems

| Problem | Solution |
| --- | --- |
| When enabling/disabling extensions and/or changing settings and in rare cases e.g. after System Suspend this extension could get out-of-sync in automatic mode | Simply open Overview and close it again to resync |

---

## License & Terms

Floating Mini Panel is available under the terms of the GPL-v2 or later license. See [LICENSE](https://github.com/ghi59/floating-mini-panel/blob/master/LICENSE) for details.
