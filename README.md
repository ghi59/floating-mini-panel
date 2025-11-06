# Floating Mini Panel GNOME Shell Extension

## Introduction

 ![Screenshot from 20240928 182100](img/Floating-Mini-Panel-Dark.png?msec=1751949159799) ![](img/Floating-Mini-Panel-Light.png?msec=1751949159799)

Floating Mini Panel replaces the Gnome Main Panel with a movable and always-on-top`Mini Panel` with just the DateMenu and QuickSettings. Both menus are fully functional and behave like expected. The `Mini Panel`can be moved anywhere on the desktop by dragging it with the handle button. It will align itself, when dragged over screen edges. A click on the handle button will show AppGrid together with the Gnome Main Panel. To reach obscured window or desktop elements it can be hidden for 5 seconds by right clicking the handle button, or simply moved out of the way.

---

## Features

- Vertical Orientation <mark>(new)</mark>

- Predefined Positions, Dynamic Border Corners, Menu

- System-, Extension- and App-Indicator (<u>no legacy appicons</u>) support
  
- Indicator Drawer and Always-Visible-Area
  
- Auto Mode
  
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

## Usage

Simply enable Floating Mini Panel via QuickSettings menu and place it where you prefer.

**Attention**:
When installing for the first time or disable/enable accross sessions, you have to logout and login again, because this extension relies on the GNOME Shell 'startup-complete' signal to function correctly!

There are two modes of operation, which you can activate in the QuickToggle menu of the `Mini Panel` in QuickSettings. Selecting a mode will automatically enable the `Mini Panel` if it was disabled.

**1. Permanent Mode**: If this mode is enabled, the Main Panel will be permanently (with the exception of Overview) hidden and the `Mini Panel` shown instead. Since version 6 Permanent Mode will be automatically switched to Auto Mode if a panel-hiding extension is enabled and also disallowed until no panel-hiding extension is active anymore (you will be informed by notification popups).

**2. Automatic Mode**: In this mode the `Mini Panel` will only be shown, if the Main Panel is hidden. There are several ways to hide the Main Panel:
  
  | 3rd Party Extension | Actions | Settings |
  | --- | --- | --- |
  | w/o | Fullscreen (F11) | w/o |
  | PaperWM | Switch workspaces | Hide Top Panel per workspace |
  | Hide Top Bar | - Dodge window to Main Panel<br/>- Maximze window<br/>- Fullscreen (F11)<br/>- Reveal/Hide Main Panel | Intelli-Hide |
  | Dash To Panel | - Dodge window to Main Panel<br/>- Maximze window<br/>- Fullscreen (F11)<br/>- Reveal/Hide Main Panel | Intelli-Hide |
  

**Tip**: To disable the revealing of Main Panel by mouse, disable `Show panel when mouse approaches edge of screen` for 'Hide Top Bar' and/or set `Required pressure threshold (px)`to `9990` for 'Dash To Panel'.

Since version 4 there is support for System-, Extension- and App-Indicators w/o Legacy AppIcons. The indicators are placed in a **Drawer** and a **Always-Visible-Area**. App-Indicators are always placed in the Always-Visible-Area and cannot be moved in the Drawer, because of a technical reason, but also because it makes no sense to hide them (if you don't like that, disable App-Indicators support in GNOME Extension Manager or if possible in the app itself).

- To open and close the Drawer do a middle click on the Handle Button.
  
- To move an indicator from the Drawer to the Always-Visible-Area and vice versa do a middle click on the indicator itself.
  
  The order of the indicators follows their order in the Main Panel. As soon as there are indicators in the Drawer and in the Always-Visible-Area and the Drawer is opened, a small divider between the two areas will be visible. Closing the Drawer, or moving all indicators out of the Drawer (which would make no sense, because someone could just leave the Drawer open with the same result) or out of the Always-Visible-Area, will hide the divider. All your customizations will be written to the extension settings and restored across sessions.

Since version 7 there is support for Predefined Positions (Top-Start, Top-Center, Top-End, Bottom-Start, Bottom-Center, Bottom-End). If `Mini Panel` is aligned to screen edges the border corners (rounded, not rounded) will adjust automatically.
If positioned to Top-Center or Bottom-Center `Mini Panel` will stay centered when its width changes (e.g. Drawer open/closed). A menu was added presenting all available actions, which all can be executed directly with mouse clicks and some modifier keys.

- To open the menu do a right button longpress on the Handle Button.

Since version 8 Vertical Orientation (experimental) is available. Switching between horizontal amd vertical orientation will reset the alignment to none. 

- To change the orientation do a middle button longpress.

**Be aware that most but not all Extension Indicators are supported well , especially very complex indicators e.g. 'Media Controls' might have problems or missing functionality! I am working on it.**

But if you are using a "normal" extension with an indicator and experience problems, let me know by opening an issue.

---

## Coding

This extension mainly relies on <u>Property Bindings</u> and <u>Signals</u>. Neither <u>deprecated functions</u> nor <u>code injections</u> are used. Further it is not very intrusive into the GNOME Shell code respective into the running system.

1. What is changed in all modes:
   - The `Mini Panel` is added (TopChrome) to the system.
   - Unredirection is disabled and the Enable-Unredirection-Function is monkey-patched.
   - Custom Hotkey Handlers for DateMenu and Quicksettings menus.
   - SourceActor for DateMenu and Quicksettings menus.
   - ArrowAlignment for DateMenu and Quicksettings menus.
   - Bottom padding for menus (globally via CSS).


2. What is changed additionally in permanent mode:
   - PanelBox is moved out of the visible screen area and vice versa.
   - PanelBox is untracked and vice versa.

 
3. What is changed additionally in automatic mode:
   - Nothing.


4. What is changed additionally for System-, Extension- and App-Indicators:  
   - SourceActor for menus.
   - ArrowAlignment menus.


5. What is changed additionally for Vertical Orientation:
   - UserArrowSide for menus.

---

## Future Enhancements

| Feature | Status |
| --- | --- |
| Stand-alone Automatic Mode (w/o 3rd party extensions) | planned |
| Issue #1: Present 3rd party indicators (Bartender Style MacOS) | <mark>Available since Version 4</mark> |
| Favorites menu via middle click on handle button | Not neccessary anymore, if 3rd party indicators are available in `Mini Panel` |
| QuickSettings scroll actions (Volume, Caffeine, Workspace) | <mark>Available since Version 4</mark> |
| Issue #4: Touchscreen support | Planned |
| Issue #5: Predefined Locations (Top-Left,  Top-Center, Top-Right, Bottom-Left, Bottom-Center, Bottom-Right) | <mark>Available since version 7</mark> |
| Issue #5: Default Location and Edge Offset | Coding done and testing ongoing. Availability postponed |
| Vertical Orientation | <mark>Available since version 8</mark> |
| Issue #11: Theming (Light/Dark, Icon- & Font-Size, Spacing, etc.) | Coding ongoing |
| Stabilize behavior in 'permanent mode' on Startup, Lock Screen, Suspend and Enable/Disable | <mark>Available since version 5</mark> |
| Settings | Planned |
| Issue #12 - Keyboard Shortcut for hiding the floating panel | Planned |

---

## Known Problems

| Problem | Solution / Workaround |
| --- | --- |
| When enabling/disabling extensions and/or changing settings and in rare cases e.g. after System Suspend this extension could get out-of-sync in automatic and permanent mode | Simply open Overview and close it again to resync |
| When enabling ArcMenu during runtime it's Menu is not aligned correctly to the Indicator in the `Mini Panel`. | Simply open Overview and close it again to align the menu correctly |
| AppIndicator icon of Zoom doesn't show up in `Mini Panel` | Start Zoom with Main Panel shown |

---

## Version History

**Version 8**

- Vertical Orientation

- Unredirection is disabled and the Enable-Unredirection-Function is monkey-patched

- Bug fixing


**Version 7**

- Improved Realigning / Relocating

- Predefined Positions

- Dynamic Border Corners

- Menu

- Code refactored and bug fixing.

- Support for GNOME 46 and 49

- Style (css) changes

**Version 6**

- Improved and enhanced Showing / Hiding behavior on Startup, Lock Screen, Suspend and Enable / Disable.
  
- Panel-hiding extensions are tracked and when enabled, `Mini Panel` switches into Auto Mode and Permanent Mode is not allowed (and vice versa).

- Bug fixing.


**Version 5**

- **Rejected**: Missing GObject.disconnect code added in destroy().


**Version 4**

- **Bug**: Turning of `Mini Panel` in Auto Mode via QuickSettings and turning back on, switched it into Permanent Mode w/o updating subtitle of toggle in QuickSettings corrected.
  
- Scroll Actions for Volume In, Volume Out and Caffeine on QuickSettings indicators and for Workspace switching on Handle Button added.
  
- **Issue #1**: Support for System-, Extension- and App-Indicators w/o Legacy AppIcons in Drawer (Bartender style) and Always-Visible-Area added.
  
- QuickToggle code refactored.
  
- **Issue #3**: Check for existance of QuickSettings._system before connecting to signal.
  

**Version 3**

- Auto Mode added
  
- **Issue #2**: Hotkey support for DateMenu and QuickSettings added.
  
- Missing functionality in relocation code added.
  
- Showing of `Mini Panel` with animation added.
  

**Verion 2**

- **Rejected**: Missing GLib.Timeout cleanup code added.

**Version 1**

- Initial code with permanent hiding of Main Panel, left click on Handle Button for Overview and right click for hiding (5 sec.) of `Mini Panel`.

---

## License & Terms

Floating Mini Panel is available under the terms of the GPL-v2 or later license. See [LICENSE](https://github.com/ghi59/floating-mini-panel/blob/master/LICENSE) for details.
