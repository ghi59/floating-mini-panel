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
const QUICKSETTINGS = Main.panel.statusArea['quickSettings'];
const QUICKSOURCEACTOR = QUICKSETTINGS.menu.sourceActor;
const QUICKARROWALIGNMENT = QUICKSETTINGS.menu._arrowAlignment;

const shellVersion = parseFloat(Config.PACKAGE_VERSION);

export const QuickButton = GObject.registerClass(
    class QuickButton extends St.BoxLayout {
        constructor(parent) {
            super({
                name: 'quickBtn',
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
                        QUICKSETTINGS.menu._boxPointer._userArrowSide =
                            St.Side.LEFT;
                    } else {
                        QUICKSETTINGS.menu._boxPointer._userArrowSide =
                            St.Side.TOP;
                    }
                    return [binding, value];
                },
                null
            );

            this.connect('notify::mapped', () => {
                QUICKSETTINGS.menu.close();
                if (this.mapped) {
                    QUICKSETTINGS.menu.sourceActor = this;
                    QUICKSETTINGS.menu._arrowAlignment = 0.5;
                    // START CODE VERTICAL
                    if (this[this.orientStr])
                        QUICKSETTINGS.menu._boxPointer._userArrowSide =
                            St.Side.LEFT;
                } else {
                    QUICKSETTINGS.menu.sourceActor = QUICKSOURCEACTOR;
                    QUICKSETTINGS.menu._arrowAlignment = QUICKARROWALIGNMENT;
                    // START CODE VERTICAL
                    QUICKSETTINGS.menu._boxPointer._userArrowSide = St.Side.TOP;
                }
            });

            this.connect('button-press-event', (obj, event) => {
                if (event.get_button() === 1) QUICKSETTINGS.menu.toggle();
                // Open QuickSettings menu with ShutdownItem menu opened
                // with right click
                if (event.get_button() === 3) {
                    QUICKSETTINGS.menu.toggle();
                    QUICKSETTINGS._system._systemItem.menu.toggle();
                }
            });

            this._qmConId = QUICKSETTINGS.menu.connect(
                'open-state-changed',
                () => {
                    if (this.has_style_pseudo_class('active')) {
                        this.remove_style_pseudo_class('active');
                    } else {
                        this.add_style_pseudo_class('active');
                    }
                    return GLib.SOURCE_PROPAGATE;
                }
            );

            this._cloneIndicators();

            // If QuickSettings indicators are added or removed
            // !!! make own functions for add and remove (array splice) !!!
            this._qiConId = QUICKSETTINGS._indicators.connectObject(
                'child-added',
                this._cloneIndicators.bind(this),
                'child-removed',
                this._cloneIndicators.bind(this),
                this
            );

            if (QUICKSETTINGS._system) {
                // Close QuickSettings menu when PowerToggle is clicked.
                this._ptConId1 =
                    QUICKSETTINGS._system._systemItem._powerToggle.connect(
                        'clicked',
                        () => {
                            QUICKSETTINGS.menu.close();
                        }
                    );

                // Close QuickSettings menu when SettingsItem is clicked.
                let childs =
                    QUICKSETTINGS._system._systemItem.firstChild.get_children();
                for (let child of childs) {
                    if (child._settingsApp) {
                        this._settingsItem = child;
                        this._siConId2 = this._settingsItem.connect(
                            'clicked',
                            () => {
                                QUICKSETTINGS.menu.close();
                            }
                        );
                        break;
                    }
                }

                // Close QuickSettings menu when Shutdown-Suspend is clicked.
                this._simConId3 =
                    QUICKSETTINGS._system._systemItem.menu.connect(
                        'activate',
                        () => {
                            QUICKSETTINGS.menu.close();
                        }
                    );
            }

            Main.wm.setCustomKeybindingHandler(
                'toggle-quick-settings',
                Shell.ActionMode.NORMAL |
                    Shell.ActionMode.OVERVIEW |
                    Shell.ActionMode.POPUP,
                this._toggleQuickSettings.bind(this)
            );
        }

        _toggleQuickSettings() {
            if (this.visible || PANELBOX.visible) {
                QUICKSETTINGS.menu.toggle();
                if (QUICKSETTINGS.menu.isOpen) {
                    QUICKSETTINGS.menu.actor.navigate_focus(
                        null,
                        St.DirectionType.TAB_FORWARD,
                        false
                    );
                }
            }
        }

        _create_clone(orgInd, type, i) {
            this._orgInds[i] = orgInd;
            if (type === 'gicon') {
                this._cloneInds[i] = new St.Icon({
                    style_class: 'system-status-icon',
                    visible: true,
                });
            } else {
                this._cloneInds[i] = new St.Label({
                    y_expand: true,
                    y_align: Clutter.ActorAlign.CENTER,
                    visible: true,
                });
            }

            // Scrolling on output volume
            if (orgInd.get_parent()) {
                if (orgInd.get_parent()._output) {
                    this._cloneInds[i].reactive = true;
                    this._cloneInds[i].connect('scroll-event', (actor, event) =>
                        this._orgInds[i]
                            .get_parent()
                            ._handleScrollEvent(
                                this._orgInds[i].get_parent()._output,
                                event
                            )
                    );
                }

                // Scrolling on input volume
                if (orgInd.get_parent()._input) {
                    this._cloneInds[i].reactive = true;
                    this._cloneInds[i].connect('scroll-event', (actor, event) =>
                        this._orgInds[i]
                            .get_parent()
                            ._handleScrollEvent(
                                this._orgInds[i].get_parent()._input,
                                event
                            )
                    );
                }

                // Scrolling on Caffeine
                if (orgInd.get_parent()._name === 'Caffeine') {
                    this._cloneInds[i].reactive = true;
                    this._cloneInds[i].connect('scroll-event', (actor, event) =>
                        this._orgInds[i].get_parent()._handleScrollEvent(event)
                    );
                }
            }

            this.add_child(this._cloneInds[i]);
            this._orgInds[i].bind_property(
                type,
                this._cloneInds[i],
                type,
                GObject.BindingFlags.SYNC_CREATE
            );
            this._orgInds[i].bind_property(
                'visible',
                this._cloneInds[i],
                'visible',
                GObject.BindingFlags.SYNC_CREATE
            );
        }

        _cloneIndicators() {
            this._cloneInds = [];
            this._orgInds = [];
            this.remove_all_children();

            let quickInds = QUICKSETTINGS._indicators;
            let i = 0;
            for (const ind of quickInds) {
                if (ind._indicator) {
                    this._create_clone(ind._indicator, 'gicon', i);
                    if (ind._percentageLabel) {
                        // Battery Percentage
                        i++;
                        this._create_clone(ind._percentageLabel, 'text', i);
                    }
                    if (ind._timerLabel) {
                        // Caffeine Timer
                        i++;
                        this._create_clone(ind._timerLabel, 'text', i);
                    }
                    if (ind._label) {
                        // Ubuntu Net Speed
                        i++;
                        this._create_clone(ind._label, 'text', i);
                    }
                } else {
                    if (ind._vpnIndicator) {
                        this._create_clone(ind._vpnIndicator, 'gicon', i);
                    }
                    if (ind._primaryIndicator) {
                        this._create_clone(ind._primaryIndicator, 'gicon', i);
                    }
                }
                i++;
            }
        }

        destroy() {
            this._cloneInds = null;
            this._orgInds = null;

            Main.wm.setCustomKeybindingHandler(
                'toggle-quick-settings',
                Shell.ActionMode.NORMAL |
                    Shell.ActionMode.OVERVIEW |
                    Shell.ActionMode.POPUP,
                Main.wm._toggleQuickSettings.bind(Main.wm)
            );

            if (QUICKSETTINGS._system) {
                QUICKSETTINGS._system._systemItem._powerToggle.disconnect(
                    this._ptConId1
                );
                this._ptConId1 = null;

                if (this._settingsItem) {
                    this._settingsItem.disconnect(this._siConId2);
                    this._siConId2 = null;
                }

                if (this._simConId3) {
                    QUICKSETTINGS._system._systemItem.menu.disconnect(
                        this._simConId3
                    );
                    this._simConId3 = null;
                }
            }

            QUICKSETTINGS._indicators.disconnectObject(this._qiConId);
            this._qiConId = null;

            QUICKSETTINGS.menu.disconnect(this._qmConId);
            this._qmConId = null;

            super.destroy();
        }
    }
);
