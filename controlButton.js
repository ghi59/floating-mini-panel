/*
 * Floating-Mini-Panel for GNOME Shell 46+
 *
 * Copyright 2024, 2025 Gerhard Himmel
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Utils from './utils.js';

const DISPLAY = global.display;
const OVERVIEW = Main.overview;

const shellVersion = parseFloat(Config.PACKAGE_VERSION);

const Alignment = {
    NONE: 0,
    TOP: 1,
    BOTTOM: 2,
    LEFT: 4,
    RIGHT: 8,
    CENTER: 16,
};

const CtlActions = GObject.registerClass(
    class CtlActions extends Clutter.Action {
        constructor(actor) {
            super();
            this._actor = actor;
            this._parent = this._actor._parent;
            this._click = false;
            this._longpress = false;
            this._grab = null;
        }

        vfunc_handle_event(event) {
            switch (event.type()) {
                case Clutter.EventType.MOTION:
                    // Execute Drag
                    if (this._grab !== null) {
                        let [x, y] = event.get_coords();
                        x = Math.ceil(x - this._actor.width / 2);
                        y = Math.ceil(y - this._actor.height / 2);
                        this._parent.set_position(x, y);
                    }
                    break;
                case Clutter.EventType.BUTTON_PRESS:
                    // Test longpress
                    if (this._timeoutId) {
                        GLib.Source.remove(this._timeoutId);
                        this._timeoutId = null;
                    }
                    this._timeoutId = GLib.timeout_add(
                        GLib.PRIORITY_DEFAULT,
                        250,
                        () => {
                            if (!this._click) {
                                this._longpress = true;
                                // Ignoring modifier keys (event.get_state())
                                switch (event.get_button()) {
                                    case Clutter.BUTTON_PRIMARY:
                                        this._leftBtnLongPress();
                                        break;
                                    case Clutter.BUTTON_MIDDLE:
                                        this._middleBtnLongPress();
                                        break;
                                    case Clutter.BUTTON_SECONDARY:
                                        this._rightBtnLongPress();
                                        break;
                                    default:
                                        break;
                                }
                            }
                            this._timeoutId = null;
                            return GLib.SOURCE_REMOVE;
                        }
                    );
                    break;
                case Clutter.EventType.BUTTON_RELEASE:
                    // Button released after longpress
                    if (this._longpress) {
                        // End Drag and clean up
                        if (this._grab !== null) {
                            Main.popModal(this._grab);
                            this._grab.dismiss();
                            this._grab = null;
                            this._actor.firstChild.opacity = 255;
                            DISPLAY.set_cursor(Meta.Cursor.DEFAULT);
                            this._parent._relocate(true);
                        }
                    } else {
                        // Button released after click (quick release)
                        this._click = true;
                        let state = event.get_state();
                        switch (event.get_button()) {
                            case Clutter.BUTTON_PRIMARY:
                                this._leftBtnClick(state);
                                break;
                            case Clutter.BUTTON_MIDDLE:
                                this._middleBtnClick(state);
                                break;
                            case Clutter.BUTTON_SECONDARY:
                                this._rightBtnClick(state);
                                break;
                            default:
                                break;
                        }
                    }
                    break;
                default:
                    break;
            }
        }

        // Left longpress action
        _leftBtnLongPress() {
            // Prepare Drag if no other drag is ongoing
            if (this._grab === null) {
                this._grab = Main.pushModal(this._actor);
                this._actor.remove_style_pseudo_class('focus');
                this._parent.style = null;
                this._actor.firstChild.opacity = 0;
                let cursor = Meta.Cursor.MOVE;
                if (shellVersion < 47)
                    cursor = Meta.Cursor.MOVE_OR_RESIZE_WINDOW;
                DISPLAY.set_cursor(cursor);
            }
        }

        // Middle longpress action
        _middleBtnLongPress() {
        }

        // Right longpress action
        _rightBtnLongPress() {
            this._actor.menu.toggle();
        }
        
        // Left click
        _leftBtnClick(state) {
            switch (state) {
                case 0:
                    (OVERVIEW.visible) ? OVERVIEW.toggle() : OVERVIEW.showApps();
                    break;
                case Clutter.ModifierType.SHIFT_MASK:
                    this._actor._doAlign(Alignment.LEFT | Alignment.TOP);
                    break;
                case Clutter.ModifierType.CONTROL_MASK:
                    this._actor._doAlign(Alignment.LEFT | Alignment.BOTTOM);
                    break;
                default:
                    break;
            }
        }

        // Middle click
        _middleBtnClick(state) {
            switch (state) {
                case 0:
                    this._parent._indsDrawer.toggle();
                    break;
                case Clutter.ModifierType.SHIFT_MASK:
                    this._actor._doAlign(Alignment.CENTER | Alignment.TOP);
                    break;
                case Clutter.ModifierType.CONTROL_MASK:
                    this._actor._doAlign(Alignment.CENTER | Alignment.BOTTOM);
                    break;
                default:
                    break;
            }
        }

        // Right click
        _rightBtnClick(state) {
            switch (state) {
                case 0:
                    this._actor._hideParent();
                    break;
                case Clutter.ModifierType.SHIFT_MASK:
                    this._actor._doAlign(Alignment.RIGHT | Alignment.TOP);
                    break;
                case Clutter.ModifierType.CONTROL_MASK:
                    this._actor._doAlign(Alignment.RIGHT | Alignment.BOTTOM);
                    break;
                default:
                    break;
            }
        }

        // Register new button press and release with 'return true'
        vfunc_register_sequence(event) {
            // Reset detected Click and Longpress properties here before a new
            // Press-Release-Cycle starts, because they are needed during
            // the complete cycle.
            if (event.type() === Clutter.EventType.BUTTON_PRESS) {
                this._click = false;
                this._longpress = false;
            }
            return true;
        }

        vfunc_sequence_cancelled() {
        }

        destroy() {
            if (this._timeoutId) {
                GLib.Source.remove(this._timeoutId);
                this._timeoutId = null;
            }
            super.destroy();
        }
    }
);

const MenuItem = GObject.registerClass(
    class MenuItem extends PopupMenu.PopupBaseMenuItem {
        constructor(name, hotkey, action, params) {
            super(params);
            this.add_child(
                new St.Label({
                    text: name,
                    x_expand: true,
                    x_align: Clutter.ActorAlign.START,
                    style: 'padding-right: 12px;',
                })
            );
            this.add_child(
                new St.Label({
                    text: hotkey,
                    x_expand: true,
                    x_align: Clutter.ActorAlign.END,
                    style: 'color: grey !important;',
                })
            );
            this.connect('activate', () => action());
        }
    }
);

export const ControlButton = GObject.registerClass(
    class ControlButton extends St.BoxLayout {
        constructor(parent) {
            super({
                name: 'ctlBtn',
                reactive: true,
                track_hover: true,
                style_class: 'button ctlBtn',
            });

            this._parent = parent;

            // Future Enhancement
            this._orient = false;

            this.add_child(
                new St.Icon({
                    icon_name: 'list-drag-handle-symbolic',
                    style_class: 'system-status-icon',
                    x_expand: true,
                    x_align: Clutter.ActorAlign.CENTER,
                })
            );

            // Handling for GNOME 46, 47, 48, 49
            this.add_action(new CtlActions(this));

            this.connect('scroll-event', (obj, event) => {
                Main.wm.handleWorkspaceScroll(event);
            });

            // Control Menu
            this.menu = new PopupMenu.PopupMenu(this, 0.5, St.Side.TOP);
            Main.uiGroup.add_child(this.menu.actor);
            Main.panel.menuManager.addMenu(this.menu);
            this.menu.actor.hide();

            let ltTxt = this._orient ? 'Left' : 'Top';
            let rbTxt = this._orient ? 'Right' : 'Bottom';

            this.menu.addMenuItem(
                new PopupMenu.PopupSeparatorMenuItem('Auto Position')
            );
            this.menu.addMenuItem(
                new MenuItem(ltTxt + '-Start', 'Shift + Left Click', () => {
                    this._doAlign(Alignment.TOP | Alignment.LEFT);
                })
            );
            this.menu.addMenuItem(
                new MenuItem(ltTxt + '-Center', 'Shift + Middle Click', () => {
                    this._doAlign(Alignment.TOP | Alignment.CENTER);
                })
            );
            this.menu.addMenuItem(
                new MenuItem(ltTxt + '-End', 'Shift + Right Click', () => {
                    this._doAlign(Alignment.TOP | Alignment.RIGHT);
                })
            );
            this.menu.addMenuItem(
                new MenuItem(rbTxt + '-Start', 'Ctrl + Left Click', () => {
                    this._doAlign(Alignment.BOTTOM | Alignment.LEFT);
                })
            );
            this.menu.addMenuItem(
                new MenuItem(rbTxt + '-Center', 'Ctrl + Middle Click', () => {
                    this._doAlign(Alignment.BOTTOM | Alignment.CENTER);
                })
            );
            this.menu.addMenuItem(
                new MenuItem(rbTxt + '-End', 'Ctrl + Right Click', () => {
                    this._doAlign(Alignment.BOTTOM | Alignment.RIGHT);
                })
            );

            this.menu.addMenuItem(
                new PopupMenu.PopupSeparatorMenuItem('Control Functions')
            );
            this.menu.addMenuItem(
                new MenuItem('Show AppGrid', 'Left Click', () => {
                    (!OVERVIEW.visible) ? OVERVIEW.toggle() : OVERVIEW.showApps();
                })
            );
            this.menu.addMenuItem(
                new MenuItem('Toggle Drawer', 'Middle Click', () => {
                    this._parent._indsDrawer.toggle();
                })
            );
            this.menu.addMenuItem(
                new MenuItem('Hide', 'Right Click', () => {
                    this._hideParent();
                })
            );
            this.menu.addMenuItem(
                new MenuItem('Move', 'Left LongPress', () => {}, {
                    reactive: false,
                })
            );
            /* FUTURE ENHANCEMENT
            this.menu.addMenuItem(new MenuItem('Toggle Orientation', 'Middle LongPress', () => {
            }));
            */
            this.menu.addMenuItem(
                new MenuItem('Toggle Menu', 'Right LongPress', () => {})
            );
            /* FUTURE ENHANCEMENT
            this.menu.addMenuItem(new MenuItem('Default Position', 'Shift + Ctrl + Left Click', () => {
            }));
            this.menu.addMenuItem(new MenuItem('Set Default Position', 'Shift + Ctrl + Middle Click', () => {
            }));
            this.menu.addMenuItem(new MenuItem('Toggle Edge Offset', 'Shift + Ctrl + Right Click', () => {
            }));
            */

            this.menu.connect('open-state-changed', () => {
                if (this.has_style_pseudo_class('active')) {
                    this.remove_style_pseudo_class('active');
                } else {
                    this.add_style_pseudo_class('active');
                }
                return GLib.SOURCE_PROPAGATE;
            });
        }

        _doAlign(align) {
            this._parent._sets.set_int('aligned', align);
            this._parent._relocate(false);
        }

        _hideParent() {
            // Hide this for 5 sec.
            this._parent.hide();
            if (this._timeoutId) {
                GLib.Source.remove(this._timeoutId);
                this._timeoutId = null;
            }
            this._timeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                5000,
                () => {
                    if (
                        // Bug fix v5
                        Utils.panelBoxHidden() &&
                        !OVERVIEW.visible
                    )
                        this._parent.show();
                    this._timeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        }

        destroy() {
            if (this._timeoutId) {
                GLib.Source.remove(this._timeoutId);
                this._timeoutId = null;
            }
            super.destroy();
        }
    }
);
