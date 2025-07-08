/*
 * Floating-Mini-Panel for GNOME Shell 47+
 *
 * Copyright 2024 Gerhard Himmel
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
import Mtk from 'gi://Mtk';
import Shell from 'gi://Shell';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

const LAYOUTMANAGER = Main.layoutManager;
const PANEL = Main.panel;
const PANELBOX = LAYOUTMANAGER.panelBox;
const OVERVIEW = Main.overview;
const DISPLAY = global.display;
const DATEMENU = PANEL.statusArea['dateMenu'];
const DATESOURCEACTOR = DATEMENU.menu.sourceActor;
const DATEARROWALIGNMENT = DATEMENU.menu._arrowAlignment;
const QUICKSETTINGS = PANEL.statusArea['quickSettings'];
const QUICKSOURCEACTOR = QUICKSETTINGS.menu.sourceActor;
const QUICKARROWALIGNMENT = QUICKSETTINGS.menu._arrowAlignment;

const State = {
    OFF: 0,
    ON: 1,
    AUTO: 2,
};

const FloatingMiniPanel = GObject.registerClass(
    class FloatingMiniPanel extends St.BoxLayout {
        constructor(sets) {
            super({
                name: 'FloatingMiniPanel',
                style_class: 'button',
                reactive: true,
                can_focus: true,
                visible: false,
            });

            this._sets = sets;
            this._state = this._sets.get_int('state');

            this.set_position(
                this._sets.get_int('pos-x'),
                this._sets.get_int('pos-y')
            );

            // Control Button --------------------------------------------------
            this._ctlBtn = new St.BoxLayout({
                name: 'ctlBtn',
                reactive: true,
                track_hover: true,
                style_class: 'button',
            });
            this._ctlBtn.add_child(
                new St.Icon({
                    icon_name: 'list-drag-handle-symbolic',
                    style_class: 'system-status-icon',
                    x_expand: true,
                    x_align: Clutter.ActorAlign.CENTER,
                })
            );
            this.add_child(this._ctlBtn);

            // Date Button -----------------------------------------------------
            this._dateBtn = new St.BoxLayout({
                name: 'dateBtn',
                reactive: true,
                track_hover: true,
                style_class: 'button',
            });
            this._dateBtn.connect('button-press-event', () => {
                DATEMENU.menu.toggle();
            });
            this._dmConId = DATEMENU.menu.connect('open-state-changed', () => {
                if (this._dateBtn.has_style_pseudo_class('selected')) {
                    this._dateBtn.remove_style_pseudo_class('selected');
                } else {
                    this._dateBtn.add_style_pseudo_class('selected');
                }
                return GLib.SOURCE_PROPAGATE;
            });
            this.add_child(this._dateBtn);
            this._dateLabel = new St.Label({
                text: DATEMENU._clockDisplay.text,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
                style: 'padding-top: 2px;', // Align with percentage label
            });
            this._dateConId = DATEMENU._clockDisplay.bind_property(
                'text',
                this._dateLabel,
                'text',
                GObject.Binding.CREATE_SYNC
            );
            this._dateBtn.add_child(this._dateLabel);
            this._noteIcon = new St.Icon({
                style_class: 'system-status-icon',
                visible: DATEMENU._indicator.visible,
            });
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
            this._dateBtn.add_child(this._noteIcon);

            // Quick Button ----------------------------------------------------
            this._quickBtn = new St.BoxLayout({
                name: 'quickBtn',
                reactive: true,
                track_hover: true,
                style_class: 'button',
            });
            this._quickBtn.connect('button-press-event', () => {
                QUICKSETTINGS.menu.toggle();
            });
            this._qmConId = QUICKSETTINGS.menu.connect(
                'open-state-changed',
                () => {
                    if (this._quickBtn.has_style_pseudo_class('selected')) {
                        this._quickBtn.remove_style_pseudo_class('selected');
                    } else {
                        this._quickBtn.add_style_pseudo_class('selected');
                    }
                    return GLib.SOURCE_PROPAGATE;
                }
            );
            this.add_child(this._quickBtn);

            this._cloneIndicators();

            // Clutter.Clone is very convinient, but I did not find a way to
            // set the indicators color in Light/Dark Mode!
            //
            // this._quickBtn.add_child(new Clutter.Clone({
            //     name: 'quickClone',
            //     source: QUICKSETTINGS._indicators,
            // }));

            // QuickSettings Toggle --------------------------------------------
            this._fmpQuickToggle = new QuickSettings.QuickMenuToggle({
                icon_name: 'view-restore-symbolic',
                title: 'Mini Panel',
                menu_enabled: true,
                toggleMode: true,
            });

            // START CODE AUTO MODE
            this._fmpQuickToggle.menu.setHeader(
                'view-restore-symbolic',
                'Mini Panel',
                null
            );

            this._autoItem = new PopupMenu.PopupImageMenuItem(
                'Automatic',
                null
            );
            this._fmpQuickToggle.menu.addMenuItem(this._autoItem);
            this._autoItem.connect('activate', () => {
                QUICKSETTINGS.menu.close();
                this._permItem.setOrnament(PopupMenu.Ornament.NONE);
                this._autoItem.setOrnament(PopupMenu.Ornament.CHECK);
                this._fmpQuickToggle.subtitle = this._autoItem.label.text;
                this._fmpQuickToggle.checked = true;
                if (this.visible) this._hideFloatingMiniPanel();

                this._state = State.AUTO;
                this._sets.set_int('state', this._state);

                let priMon = DISPLAY.get_primary_monitor();
                let priMonGeo = DISPLAY.get_monitor_geometry(priMon);
                if (
                    PANELBOX.y < priMonGeo.y ||
                    Math.abs(PANELBOX.translation_y) === PANELBOX.height ||
                    Math.abs(PANELBOX.translation_x) === PANELBOX.width
                ) {
                    this._showFloatingMiniPanel();
                }
                if (this.visible || PANELBOX.visible) QUICKSETTINGS.menu.open();
            });

            this._permItem = new PopupMenu.PopupImageMenuItem(
                'Permanent',
                null
            );
            this._fmpQuickToggle.menu.addMenuItem(this._permItem);
            this._permItem.connect('activate', () => {
                QUICKSETTINGS.menu.close();
                this._permItem.setOrnament(PopupMenu.Ornament.CHECK);
                this._autoItem.setOrnament(PopupMenu.Ornament.NONE);
                this._fmpQuickToggle.subtitle = this._permItem.label.text;
                this._fmpQuickToggle.checked = true;

                this._state = State.ON;
                this._sets.set_int('state', this._state);

                if (!OVERVIEW.visible) this._showFloatingMiniPanel();
                if (this.visible || PANELBOX.visible) QUICKSETTINGS.menu.open();
            });

            // Initialize menu
            if (this._state === State.AUTO) {
                this._fmpQuickToggle.subtitle = this._autoItem.label.text;
                this._permItem.setOrnament(PopupMenu.Ornament.NONE);
                this._autoItem.setOrnament(PopupMenu.Ornament.CHECK);
            } else {
                this._fmpQuickToggle.subtitle = this._permItem.label.text;
                this._permItem.setOrnament(PopupMenu.Ornament.CHECK);
                this._autoItem.setOrnament(PopupMenu.Ornament.NONE);
            }

            this._fmpQuickToggle.connect('clicked', () => {
                QUICKSETTINGS.menu.close();
                if (this._state !== State.OFF) {
                    this._hideFloatingMiniPanel();
                    this._state = State.OFF;
                    this._sets.set_int('state', this._state);
                } else {
                    if (this._autoItem.ornament === PopupMenu.Ornament.CHECK) {
                        this._state = State.AUTO;
                    } else {
                        this._state = State.ON;
                        this._showFloatingMiniPanel();
                    }
                    this._sets.set_int('state', this._state);
                }
                if (this.visible || PANELBOX.visible) QUICKSETTINGS.menu.open();
            });
            // END CODE AUTO MODE

            this._fmpQuickToggle.checked = this._state; // Make a binding :-)
            this._fmpQuickIndicator = new QuickSettings.SystemIndicator();
            this._fmpQuickIndicator.quickSettingsItems.push(
                this._fmpQuickToggle
            );
            QUICKSETTINGS.addExternalIndicator(this._fmpQuickIndicator);

            // FloatingMiniPanel Actions ---------------------------------------
            this._conId = null;
            this._grab = null;
            let action = new Clutter.ClickAction();
            action.connect('clicked', () => {
                this._actionClicked = true;
                if (this._grab === null) {
                    switch (action.get_button()) {
                        case 1:
                            if (!OVERVIEW.visible) {
                                OVERVIEW.showApps();
                            } else {
                                OVERVIEW.toggle();
                            }
                            break;
                        case 2:
                            break;
                        case 3:
                            // Hide this for 5 sec.
                            this.hide();
                            if (this._timeoutId1) {
                                GLib.Source.remove(this._timeoutId1);
                                this._timeoutId1 = null;
                            }
                            this._timeoutId1 = GLib.timeout_add(
                                GLib.PRIORITY_DEFAULT,
                                5000,
                                () => {
                                    if (
                                        (!PANELBOX.visible &&
                                            !OVERVIEW.visible) ||
                                        this._state === State.ON
                                    )
                                        this.show();
                                    this._timeoutId1 = null;
                                    return GLib.SOURCE_REMOVE;
                                }
                            );
                            break;
                        default:
                    }
                }
            });
            action.connect('long-press', (a, actor, state) => {
                if (state !== Clutter.LongPressState.CANCEL) return true;
                if (this._longPressLater) return true;

                const laters = global.compositor.get_laters();
                this._longPressLater = laters.add(
                    Meta.LaterType.BEFORE_REDRAW,
                    () => {
                        delete this._longPressLater;
                        if (this._actionClicked) {
                            delete this._actionClicked;
                            return GLib.SOURCE_REMOVE;
                        }
                        action.release();

                        if (this._grab === null) {
                            this._grab = Main.pushModal(this);
                            DISPLAY.set_cursor(Meta.Cursor.MOVE);
                            this._conId = this.connect(
                                'motion-event',
                                (obj, event) => {
                                    let [x, y] = event.get_coords();
                                    x = Math.ceil(
                                        x - this._ctlBtn.width / 2 - 3
                                    ); // CSS!
                                    y = Math.ceil(
                                        y - this._ctlBtn.height / 2 - 3
                                    ); // CSS!
                                    this.set_position(x, y);
                                }
                            );
                        }
                        return GLib.SOURCE_REMOVE;
                    }
                );
                return GLib.SOURCE_REMOVE;
            });
            this._ctlBtn.add_action(action);
            this.connect('button-release-event', () => {
                if (this._longPressLater !== null) delete this._longPressLater;
                if (this._grab !== null) {
                    this.disconnect(this._conId);
                    this._conId = null;
                    Main.popModal(this._grab);
                    this._grab.dismiss();
                    this._grab = null;
                    DISPLAY.set_cursor(Meta.Cursor.DEFAULT);
                    this._relocate(true);
                }
            });

            // FloatingMiniPanel Controlling -----------------------------------

            // START CODE AUTO MODE
            this._pvConId = PANELBOX.connect('notify::visible', () => {
                if (this._state === State.AUTO) {
                    if (!PANELBOX.visible) {
                        if (this._correctPanelBoxVisibleState) {
                            this._correctPanelBoxVisibleState = false;
                        } else {
                            if (!this.visible) {
                                this._showFloatingMiniPanel();
                            }
                        }
                    } else {
                        // Timeout and testing needed because transitions are
                        // used by 'HideTopPanel' and 'DashToPanel' and
                        // PanelBox.visible signal by itself is not sufficiant
                        // to decide if the PanelBox is really shown or not!
                        if (this._timeoutId2) {
                            GLib.Source.remove(this._timeoutId2);
                            this._timeoutId2 = null;
                        }
                        // A timeout of 50ms seams ok, but has to be verified.
                        this._timeoutId2 = GLib.timeout_add(
                            GLib.PRIORITY_DEFAULT,
                            50,
                            () => {
                                // Test 'HideTopPanel' / 'DashToPanel' show Panelbox
                                let priMon = DISPLAY.get_primary_monitor();
                                let priMonGeo =
                                    DISPLAY.get_monitor_geometry(priMon);
                                if (
                                    (PANELBOX.y >
                                        priMonGeo.y - PANELBOX.height &&
                                        Math.abs(PANELBOX.translation_y) <
                                            PANELBOX.height &&
                                        Math.abs(PANELBOX.translation_x) <
                                            PANELBOX.width) ||
                                    OVERVIEW.visible
                                ) {
                                    if (this._correctPanelBoxVisibleState) {
                                        this._correctPanelBoxVisibleState = false;
                                    }
                                    this._hideFloatingMiniPanel();
                                } else {
                                    // Correct unwanted PanelBox visible signal!
                                    PANELBOX.visible = false;
                                    this._correctPanelBoxVisibleState = true;
                                }
                                this._timeoutId2 = null;
                                return GLib.SOURCE_REMOVE;
                            }
                        );
                    }
                }
            });
            // END CODE AUTO MODE

            this._nwConId = this.connect('notify::width', () => {
                GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    if (this.visible) this._realign();
                    return GLib.SOURCE_REMOVE;
                });
            });

            this._wcConId = DISPLAY.connect('workareas-changed', () => {
                if (this.visible) this._relocate(false);
                return GLib.SOURCE_REMOVE;
            });

            // If QuickSettings indicators are added or removed
            // !!! make own functions for add and remove (array splice) !!!
            this._qiConId = QUICKSETTINGS._indicators.connectObject(
                'child-added',
                this._cloneIndicators.bind(this),
                'child-removed',
                this._cloneIndicators.bind(this),
                this
            );

            this._ovConId1 = OVERVIEW.connect('showing', () => {
                if (this._state === State.ON) {
                    this._hideFloatingMiniPanel();
                }
                return GLib.SOURCE_REMOVE;
            });
            this._ovConId2 = OVERVIEW.connect('hiding', () => {
                if (this._state === State.ON) {
                    this._showFloatingMiniPanel();
                }
                return GLib.SOURCE_REMOVE;
            });

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
            this._simConId3 = QUICKSETTINGS._system._systemItem.menu.connect(
                'activate',
                () => {
                    QUICKSETTINGS.menu.close();
                }
            );

            // START CODE MENU HOTKEYS
            Main.wm.setCustomKeybindingHandler(
                'toggle-message-tray',
                Shell.ActionMode.NORMAL |
                    Shell.ActionMode.OVERVIEW |
                    Shell.ActionMode.POPUP,
                this._toggleCalendar.bind(this)
            );

            Main.wm.setCustomKeybindingHandler(
                'toggle-quick-settings',
                Shell.ActionMode.NORMAL |
                    Shell.ActionMode.OVERVIEW |
                    Shell.ActionMode.POPUP,
                this._toggleQuickSettings.bind(this)
            );
            // END CODE MENU HOTKEYS

            // Complete startup
            LAYOUTMANAGER.addTopChrome(this, {trackFullscreen: false});
            global.compositor.disable_unredirect();
            if (this._state === State.ON) {
                this._showFloatingMiniPanel();
            }
        }

        // FloatingMiniPanel Procedures ----------------------------------------

        // START CODE MENU HOTKEYS
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
        // END CODE MENU HOTKEYS

        _showFloatingMiniPanel() {
            if (this._state !== State.AUTO) {
                PANEL.visible = false;
                let priMon = DISPLAY.get_primary_monitor();
                let priMonGeo = DISPLAY.get_monitor_geometry(priMon);
                PANELBOX.set_position(priMonGeo.y, -PANELBOX.height);
            }

            DATEMENU.menu.sourceActor = this._dateBtn;
            DATEMENU.menu._arrowAlignment = 0.5;
            QUICKSETTINGS.menu.sourceActor = this._quickBtn;
            QUICKSETTINGS.menu._arrowAlignment = 0.5;

            this.remove_all_transitions();
            this.opacity = 0;
            this.visible = true;
            this.ease({
                opacity: 255,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_LINEAR,
                onComplete: () => {},
            });
        }

        _hideFloatingMiniPanel() {
            /*
            this.remove_all_transitions();
            this.opacity = 255;
            this.ease({
                opacity: 0,
                duration: 250,
                mode: Clutter.AnimationMode.EASE_LINEAR,
                onComplete: () => {
                    this.visible = false;
                }
            });
*/
            this.visible = false;
            DATEMENU.menu.sourceActor = DATESOURCEACTOR;
            DATEMENU.menu._arrowAlignment = DATEARROWALIGNMENT;
            QUICKSETTINGS.menu.sourceActor = QUICKSOURCEACTOR;
            QUICKSETTINGS.menu._arrowAlignment = QUICKARROWALIGNMENT;

            if (this._state !== State.AUTO) {
                let priMon = DISPLAY.get_primary_monitor();
                let priMonGeo = DISPLAY.get_monitor_geometry(priMon);
                PANELBOX.set_position(priMonGeo.y, priMonGeo.y);
                PANEL.visible = true;
            }
        }

        _realign() {
            if (this._sets.get_boolean('aligned') === true) {
                let rect = new Mtk.Rectangle({
                    x: this.x,
                    y: this.y,
                    width: this.width,
                    height: this.height,
                });

                let monitor = DISPLAY.get_monitor_index_for_rect(rect);
                if (monitor < 0) monitor = DISPLAY.get_primary_monitor();
                let geom = DISPLAY.get_monitor_geometry(monitor);

                rect.x = geom.x + geom.width - rect.width;
                this.set_position(rect.x, rect.y);
                this._sets.set_int('pos-x', rect.x);
            } else {
                // If this is located close to the screen edge with
                // 'aligned' set to false and growing over the edge.
                this._relocate(true);
            }
        }

        _relocate(testAlign) {
            let rect = new Mtk.Rectangle({
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
            });

            let monitor = DISPLAY.get_monitor_index_for_rect(rect);
            if (monitor < 0) monitor = DISPLAY.get_primary_monitor();
            let geom = DISPLAY.get_monitor_geometry(monitor);

            if (rect.x < 0) rect.x = 0;
            if (rect.x > geom.x + geom.width - rect.width) {
                rect.x = geom.x + geom.width - rect.width;
            }

            if (testAlign) {
                if (rect.x === geom.x + geom.width - rect.width) {
                    this._sets.set_boolean('aligned', true);
                } else {
                    this._sets.set_boolean('aligned', false);
                }
            } else {
                if (this._sets.get_boolean('aligned') === true) {
                    rect.x = geom.x + geom.width - rect.width;
                }
            }

            if (rect.y < 0) rect.y = 0;
            if (rect.y > geom.y + geom.height - rect.height) {
                rect.y = geom.y + geom.height - rect.height;
            }
            this.set_position(rect.x, rect.y);
            this._sets.set_int('pos-x', rect.x);
            this._sets.set_int('pos-y', rect.y);
        }

        // Scroll Actions for 'Caffeine' and 'Volume' are not implemented!
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
            this._quickBtn.add_child(this._cloneInds[i]);
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
            this._quickBtn.remove_all_children();

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
            this._hideFloatingMiniPanel();

            this._cloneInds = null;
            this._orgInds = null;
            this._dateConId = null;
            this._noteConId1 = null;
            this._noteConId2 = null;

            // START CODE MENU HOTKEYS
            Main.wm.setCustomKeybindingHandler(
                'toggle-message-tray',
                Shell.ActionMode.NORMAL |
                    Shell.ActionMode.OVERVIEW |
                    Shell.ActionMode.POPUP,
                Main.wm._toggleCalendar.bind(Main.wm)
            );
            Main.wm.setCustomKeybindingHandler(
                'toggle-quick-settings',
                Shell.ActionMode.NORMAL |
                    Shell.ActionMode.OVERVIEW |
                    Shell.ActionMode.POPUP,
                Main.wm._toggleQuickSettings.bind(Main.wm)
            );
            // END CODE MENU HOTKEYS

            if (this._timeoutId1) {
                GLib.Source.remove(this._timeoutId1);
                this._timeoutId1 = null;
            }

            // START CODE AUTO MODE
            if (this._timeoutId2) {
                GLib.Source.remove(this._timeoutId2);
                this._timeoutId2 = null;
            }

            PANELBOX.disconnect(this._pvConId);
            this._pvConId = null;
            // END CODE AUTO MODE

            this.disconnect(this._nwConId);
            this._nwConId = null;

            DISPLAY.disconnect(this._wcConId);
            this._wcConId = null;

            OVERVIEW.disconnect(this._ovConId1);
            this._ovConId1 = null;

            OVERVIEW.disconnect(this._ovConId2);
            this._ovConId2 = null;

            QUICKSETTINGS._system._systemItem._powerToggle.disconnect(
                this._ptConId1
            );
            this._ptConId1 = null;

            this._settingsItem.disconnect(this._siConId2);
            this._siConId2 = null;

            QUICKSETTINGS._system._systemItem.menu.disconnect(this._simConId3);
            this._simConId3 = null;

            QUICKSETTINGS._indicators.disconnectObject(this._qiConId);
            this._qiConId = null;

            DATEMENU.menu.disconnect(this._dmConId);
            this._dmConId = null;

            QUICKSETTINGS.menu.disconnect(this._qmConId);
            this._qmConId = null;

            this._fmpQuickIndicator.quickSettingsItems.forEach(item =>
                item.destroy()
            );
            this._fmpQuickIndicator.destroy();
            this._fmpQuickIndicator = null;

            LAYOUTMANAGER.removeChrome(this);
            global.compositor.enable_unredirect();
        }
    }
);

export default class FloatingMiniPanelExtension extends Extension {
    enable() {
        this._floatingMiniPanel = new FloatingMiniPanel(this.getSettings());
    }

    disable() {
        this._floatingMiniPanel.destroy();
        this._floatingMiniPanel = null;
    }
}
