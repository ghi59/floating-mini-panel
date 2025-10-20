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
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const PANELBOX = Main.layoutManager.panelBox;
const DATEMENU = Main.panel.statusArea['dateMenu'];
const DATESOURCEACTOR = DATEMENU.menu.sourceActor;
const DATEARROWALIGNMENT = DATEMENU.menu._arrowAlignment;

const shellVersion = parseFloat(Config.PACKAGE_VERSION);

export const DateButton = GObject.registerClass(
    class DateButton extends St.BoxLayout {
        constructor(parent) {
            super({
                name: 'dateBtn',
                reactive: true,
                track_hover: true,
                style_class: 'button btn',
            });

            this._parent = parent;

            // START CODE VERTICAL
            this.orientStr = shellVersion > 47 ? 'orientation' : 'vertical';

            this._parent.bind_property_full(
                this.orientStr,
                this,
                this.orientStr,
                GObject.BindingFlags.SYNC_CREATE,
                (binding, value) => {
                    if (value) {
                        DATEMENU.menu._boxPointer._userArrowSide = St.Side.LEFT;
                    } else {
                        DATEMENU.menu._boxPointer._userArrowSide = St.Side.TOP;
                    }
                    return [binding, value];
                },
                null
            );

            this.connect('notify::mapped', () => {
                DATEMENU.menu.close();
                if (this.mapped) {
                    DATEMENU.menu.sourceActor = this;
                    DATEMENU.menu._arrowAlignment = 0.5;
                    // START CODE VERTICAL
                    if (this[this.orientStr])
                        DATEMENU.menu._boxPointer._userArrowSide = St.Side.LEFT;
                } else {
                    DATEMENU.menu.sourceActor = DATESOURCEACTOR;
                    DATEMENU.menu._arrowAlignment = DATEARROWALIGNMENT;
                    // START CODE VERTICAL
                    DATEMENU.menu._boxPointer._userArrowSide = St.Side.TOP;
                }
            });

            this.connect('button-press-event', () => {
                DATEMENU.menu.toggle();
            });

            this._dmConId = DATEMENU.menu.connect('open-state-changed', () => {
                if (this.has_style_pseudo_class('active')) {
                    this.remove_style_pseudo_class('active');
                } else {
                    this.add_style_pseudo_class('active');
                }
                return GLib.SOURCE_PROPAGATE;
            });

            // START CODE VERTICAL
            function formatDate(vertical) {
                let dateStr = DATEMENU._clockDisplay.text;
                if (vertical) {
                    // Divide date from time and replace spaces with newlines
                    dateStr = dateStr
                        .replace(/\u2002/g, '\n――\n')
                        .replace(/\s/g, '\n');
                    // Seconds are active
                    if (
                        dateStr.split(':').length > 2 ||
                        dateStr.split('∶').length > 2
                    ) {
                        dateStr = dateStr.replace(/:|∶/g, '\n𐤟 𐤟\n');
                    } else {
                        dateStr = dateStr.replace(/\n――/g, '');
                    }
                    // If 12h mode
                    dateStr = dateStr.replace(/\n\n/g, '\n');
                    // If 12h mode and time only
                    if (dateStr[0] === '\n') dateStr = dateStr.substring(1);
                }
                return dateStr;
            }

            this._dateLabel = new St.Label({
                // START CODE VERTICAL
                text: formatDate(this[this.orientStr]),
                x_expand: true,
                x_align: Clutter.ActorAlign.CENTER,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'padding-top: 2px;', // Align with percentage label
            });
            this.add_child(this._dateLabel);

            // START CODE VERTICAL
            this.connect('notify::' + this.orientStr, () => {
                this._dateLabel.text = formatDate(this[this.orientStr]);
            });

            this._dateConId = DATEMENU._clockDisplay.bind_property_full(
                'text',
                this._dateLabel,
                'text',
                GObject.Binding.CREATE_SYNC,
                // START CODE VERTICAL
                () => {
                    return [String, formatDate(this[this.orientStr])];
                },
                null
            );

            this._noteIcon = new St.Icon({
                style_class: 'system-status-icon',
                visible: DATEMENU._indicator.visible,
            });
            this.add_child(this._noteIcon);

            this._noteConId1 = DATEMENU._indicator.bind_property(
                'icon-name',
                this._noteIcon,
                'icon-name',
                GObject.Binding.CREATE_SYNC
            );
            this._noteConId2 = DATEMENU._indicator.bind_property(
                'visible',
                this._noteIcon,
                'visible',
                GObject.Binding.CREATE_SYNC
            );

            Main.wm.setCustomKeybindingHandler(
                'toggle-message-tray',
                Shell.ActionMode.NORMAL |
                    Shell.ActionMode.OVERVIEW |
                    Shell.ActionMode.POPUP,
                this._toggleCalendar.bind(this)
            );
        }

        _toggleCalendar() {
            if (this.visible || PANELBOX.visible) {
                DATEMENU.menu.toggle();
                if (DATEMENU.menu.isOpen) {
                    DATEMENU.menu.actor.navigate_focus(
                        null,
                        St.DirectionType.TAB_FORWARD,
                        false
                    );
                }
            }
        }

        destroy() {
            Main.wm.setCustomKeybindingHandler(
                'toggle-message-tray',
                Shell.ActionMode.NORMAL |
                    Shell.ActionMode.OVERVIEW |
                    Shell.ActionMode.POPUP,
                Main.wm._toggleCalendar.bind(Main.wm)
            );

            this._dateConId = null;
            this._noteConId1 = null;
            this._noteConId2 = null;

            DATEMENU.menu.disconnect(this._dmConId);
            this._dmConId = null;

            super.destroy();
        }
    }
);
