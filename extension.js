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
// Issue #10
import Meta from 'gi://Meta';
import Mtk from 'gi://Mtk';
import St from 'gi://St';

import * as Config from 'resource:///org/gnome/shell/misc/config.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as LoginManager from 'resource:///org/gnome/shell/misc/loginManager.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import * as IndicatorsDrawer from './indicatorsDrawer.js';
import * as ControlButton from './controlButton.js';
import * as DateButton from './dateButton.js';
import * as QuickButton from './quickButton.js';
import * as Utils from './utils.js';

// Persistent variable until restart of GNOME Shell
// Needed when this is enabled during runtime.
let startupComplete = null;

const LAYOUTMANAGER = Main.layoutManager;
const PANEL = Main.panel;
const PANELBOX = LAYOUTMANAGER.panelBox;
const OVERVIEW = Main.overview;
const DISPLAY = global.display;
const QUICKSETTINGS = PANEL.statusArea['quickSettings'];

const shellVersion = parseFloat(Config.PACKAGE_VERSION);

// Panel-Hiding Extensions
const DTP_UUID = 'dash-to-panel@jderose9.github.com';
const HTB_UUID = 'hidetopbar@mathieu.bidon.ca';

const State = {
    OFF: 0,
    ON: 1,
    AUTO: 2,
};

const Alignment = {
    NONE: 0,
    TOP: 1,
    BOTTOM: 2,
    LEFT: 4,
    RIGHT: 8,
    CENTER: 16,
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

            // Issue #10
            this._enaUnredirectFunc = null;

            this._sets = sets;
            this._state = this._sets.get_int('state');

            this.set_position(
                this._sets.get_int('pos-x'),
                this._sets.get_int('pos-y')
            );

            // START CODE VERTICAL
            this.orientStr = (shellVersion > 47) ? 'orientation' : 'vertical';

            if (this._sets.get_boolean('vertical')) {
                if (shellVersion > 47) {
                    this.orientation = Clutter.Orientation.VERTICAL;
                } else {
                    this.vertical = true;
                }
                this.add_style_pseudo_class('vertical');
            } else {
                if (shellVersion > 47) {
                    this.orientation = Clutter.Orientation.HORIZONTAL;
                } else {
                    this.vertical = false;
                }
                this.add_style_pseudo_class('horizontal');
            }
            // END CODE VERTICAL

            this._panelHidingExts = [];

            // Control Button --------------------------------------------------
            this._ctlBtn = new ControlButton.ControlButton(this);
            this.add_child(this._ctlBtn);

            // Indicators Drawer -----------------------------------------------
            this._indsDrawer = new IndicatorsDrawer.IndicatorsDrawer(this);
            this.add_child(this._indsDrawer);

            // Date Button -----------------------------------------------------
            this._dateBtn = new DateButton.DateButton(this);
            this.add_child(this._dateBtn);

            // Quick Button ----------------------------------------------------
            this._quickBtn = new QuickButton.QuickButton(this);
            this.add_child(this._quickBtn);

            // QuickSettings Toggle --------------------------------------------
            this._fmpQuickToggle = new QuickSettings.QuickMenuToggle({
                icon_name: 'view-restore-symbolic',
                title: 'Mini Panel',
                menu_enabled: true,
                toggleMode: true,
            });
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
            this._permItem = new PopupMenu.PopupImageMenuItem(
                'Permanent',
                null
            );
            this._fmpQuickToggle.menu.addMenuItem(this._permItem);

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

            // Initialize Toggle
            this._fmpQuickToggle.checked = this._state;

            // Menu item clicked
            this._fmpQuickToggle.menu.connect('activate', (obj, menuItem) => {
                if (this._fmpQuickToggle.subtitle !== menuItem.label.text) {
                    QUICKSETTINGS.menu.close();
                    this._autoItem.setOrnament(PopupMenu.Ornament.NONE);
                    this._permItem.setOrnament(PopupMenu.Ornament.NONE);
                    switch (menuItem) {
                        case this._autoItem:
                            if (this.visible) this._hideFloatingMiniPanel();
                            this._preparePermanentMode(false);
                            this._state = State.AUTO;
                            if (Utils.panelBoxHidden()) {
                                this._showFloatingMiniPanel();
                            }
                            break;
                        case this._permItem:
                            this._state = State.ON;
                            this._preparePermanentMode(true);
                            if (!OVERVIEW.visible)
                                this._showFloatingMiniPanel();
                            break;
                        default:
                    }
                    this._sets.set_int('state', this._state);
                    menuItem.setOrnament(PopupMenu.Ornament.CHECK);
                    this._fmpQuickToggle.subtitle = menuItem.label.text;
                    this._fmpQuickToggle.checked = true;
                    if (this.visible || PANELBOX.visible)
                        QUICKSETTINGS.menu.open();
                }
                return Clutter.Event_STOP;
            });

            // Toggle clicked
            this._fmpQuickToggle.connect('clicked', () => {
                QUICKSETTINGS.menu.close();
                if (this._state !== State.OFF) {
                    this._hideFloatingMiniPanel();
                    this._preparePermanentMode(false);
                    this._state = State.OFF;
                    this._sets.set_int('state', this._state);
                } else {
                    if (this._autoItem._ornament === PopupMenu.Ornament.CHECK) {
                        this._state = State.AUTO;
                        this._preparePermanentMode(false);
                        if (!PANELBOX.visible && !OVERVIEW.visible)
                            this._showFloatingMiniPanel();
                    } else {
                        this._state = State.ON;
                        this._preparePermanentMode(true);
                        this._showFloatingMiniPanel();
                    }
                    this._sets.set_int('state', this._state);
                }
                if (this.visible || PANELBOX.visible) QUICKSETTINGS.menu.open();
                return Clutter.Event_STOP;
            });

            this._fmpQuickIndicator = new QuickSettings.SystemIndicator();
            this._fmpQuickIndicator.quickSettingsItems.push(
                this._fmpQuickToggle
            );
            QUICKSETTINGS.addExternalIndicator(this._fmpQuickIndicator);

            // FloatingMiniPanel Controlling -----------------------------------

            // Auto Mode controlling
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
                        if (this._timeoutId1) {
                            GLib.Source.remove(this._timeoutId1);
                            this._timeoutId1 = null;
                        }
                        // A timeout of 50ms seams ok, but has to be verified.
                        this._timeoutId1 = GLib.timeout_add(
                            GLib.PRIORITY_DEFAULT,
                            50,
                            () => {
                                // Test 'HideTopPanel' / 'DashToPanel' show PanelBox
                                let priMonGeo = Utils.priMonitorGeometry();
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
                                this._timeoutId1 = null;
                                return GLib.SOURCE_REMOVE;
                            }
                        );
                    }
                }
                return Clutter.Event_PROPAGATE;
            });

            this.connect_object(
                'notify::width',
                () => {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                        if (this.visible) this._relocate(false);
                        return GLib.SOURCE_REMOVE;
                    });
                    return Clutter.Event_STOP;
                },
                // START CODE VERTICAL
                'notify::height',
                () => {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                        if (this.visible) this._relocate(false);
                        return GLib.SOURCE_REMOVE;
                    });
                    return Clutter.Event_STOP;
                },
                // END CODE VERTICAL
                this
            );

            this._wcConId = DISPLAY.connect('workareas-changed', () => {
                this._relocate(false);
                // Bug: Main Panel becomes visible and so we have to
                // hide it by showing this again in Permanent Mode!
                if (this._state === State.ON && !OVERVIEW.visible) {
                    this._showFloatingMiniPanel();
                }
                return Clutter.Event_PROPAGATE;
            });

            this._ovConId1 = OVERVIEW.connect('showing', () => {
                if (this._state === State.ON) {
                    this._hideFloatingMiniPanel();
                }
                return Clutter.Event_PROPAGATE;
            });

            this._ovConId2 = OVERVIEW.connect('hiding', () => {
                if (this._state === State.ON) {
                    this._showFloatingMiniPanel();
                }
                return Clutter.Event_PROPAGATE;
            });

            // Set this to Auto Mode and disable Permanent Mode if the
            // panel-hiding extension 'Dash-To-Panel' or 'Hide-Top-Bar'
            // is enabled to make sure no problems occur!
            // Check during runtime
            this._meConId = Main.extensionManager.connect(
                'extension-state-changed',
                (obj, ext) => {
                    if (
                        startupComplete &&
                        (ext.metadata.uuid === DTP_UUID ||
                            ext.metadata.uuid === HTB_UUID)
                    ) {
                        if (ext.enabled) {
                            if (
                                this._panelHidingExts.indexOf(
                                    ext.metadata.uuid
                                ) < 0
                            ) {
                                this._disablePermanentMode(ext.metadata.uuid);
                            }
                        } else {
                            if (
                                this._panelHidingExts.indexOf(
                                    ext.metadata.uuid
                                ) >= 0
                            ) {
                                this._panelHidingExts.splice(
                                    this._panelHidingExts.indexOf(
                                        ext.metadata.uuid
                                    ),
                                    1
                                );
                                if (this._panelHidingExts.length === 0) {
                                    if (this.visible)
                                        this._hideFloatingMiniPanel();
                                    this._permItem.reactive = true;
                                    Main.notify(
                                        'Floating Mini Panel allowing Permanent Mode again,',
                                        'because no panel-hiding extension is active!'
                                    );
                                }
                            }
                        }
                    }
                    return Clutter.Event_PROPAGATE;
                }
            );

            // Complete startup
            LAYOUTMANAGER.addTopChrome(this, {trackFullscreen: false});

            // Issue #10
            // Absolutely necessary code! If 'unredirect' is not disabled, this
            // will become unvisible if any app is maximized / in fullscreen.
            if (this._enaUnredirectFunc === null) {
                if (shellVersion > 47) {
                    this._enaUnredirectFunc = global.compositor.enable_unredirect;
                    global.compositor.enable_unredirect = function () {};
                    global.compositor.disable_unredirect();
                } else {
	                this._enaUnredirectFunc = Meta.enable_unredirect_for_display;
	                Meta.enable_unredirect_for_display = function(display) {};
	                Meta.disable_unredirect_for_display(global.display);
	            }
            }

            // If this is in 'permanent mode' and disabled/enabled during
            // runtime (not accross sessions!) or screen is unlocked.
            if (startupComplete && this._state === State.ON) {
                this._checkPanelHidingExts();
                if (this._permItem.reactive) {
                    this._preparePermanentMode(true);
                    this._showFloatingMiniPanel();
                }
            }
            // If this is in 'auto mode' and disabled/enabled during runtime
            // (not accross sessions!) or screen is unlocked.
            if (startupComplete && this._state === State.AUTO) {
                this._checkPanelHidingExts();
                if (Utils.panelBoxHidden()) this._showFloatingMiniPanel();
            }

            // If this is in 'permanent mode' and already enabled,
            // wait for GNOME Shell to finish startup
            this._lsConId = LAYOUTMANAGER.connect('startup-complete', () => {
                // START CODE PANEL-HIDING EXTENSIONS
                // Set this to Auto Mode and disable Permanent Mode if the
                // panel-hiding extension 'Dash-To-Panel' or 'Hide-Top-Bar'
                // is enabled to make sure no problems occur!
                // Check at startup
                this._checkPanelHidingExts();

                if (this._state === State.ON) {
                    this._preparePermanentMode(true);
                    if (!OVERVIEW.visible) this._showFloatingMiniPanel();
                }
                startupComplete = true;

                // Remove connection, we don't need it anymore
                // in the running session.
                LAYOUTMANAGER.disconnect(this._lsConId);
                this._lsConId = null;

                return Clutter.Event_PROPAGATE;
            });

            // Recognize Suspend
            this._loginManager = LoginManager.getLoginManager();
            this._lpConId = this._loginManager.connect(
                'prepare-for-sleep',
                (obj, state) => {
                    if (this._state === State.ON && state) {
                        this._hideFloatingMiniPanel();
                    }
                    if (this._state === State.ON && !state) {
                        this._showFloatingMiniPanel();
                    }
                    return Clutter.Event_PROPAGATE;
                }
            );
        }

        // FloatingMiniPanel Procedures ----------------------------------------

        // Prepare the system for permanent mode and vice versa
        // It would work without, but then we would have a lot of
        // allocation errors!
        // It has to be done before Overview is toggled, to take effect.
        // Therefore it can't be done in the show / hide functions.
        _preparePermanentMode(on) {
            if (on) {
                LAYOUTMANAGER.untrackChrome(PANELBOX);
                OVERVIEW._overview._controls._searchEntryBin.set_style(
                    `padding-top: ${PANELBOX.height}px;`
                );
            } else {
                if (LAYOUTMANAGER._findActor(PANELBOX) === -1) {
                    LAYOUTMANAGER.trackChrome(PANELBOX, {
                        affectsStruts: true,
                        trackFullscreen: true,
                    });
                    OVERVIEW._overview._controls._searchEntryBin.set_style(
                        null
                    );
                }
            }
        }

        // Check Panel-Hiding extensions
        _checkPanelHidingExts() {
            if (Main.extensionManager._extensionOrder.indexOf(DTP_UUID) >= 0) {
                let disabled = global.settings.get_strv('disabled-extensions');
                if (disabled.indexOf(DTP_UUID) < 0) {
                    this._disablePermanentMode(DTP_UUID);
                }
            }
            if (Main.extensionManager._extensionOrder.indexOf(HTB_UUID) >= 0) {
                let disabled = global.settings.get_strv('disabled-extensions');
                if (disabled.indexOf(HTB_UUID) < 0) {
                    this._disablePermanentMode(HTB_UUID);
                }
            }
        }

        _disablePermanentMode(phext) {
            if (this._panelHidingExts.indexOf(phext) < 0) {
                this._panelHidingExts.push(phext);
                if (this._permItem.reactive) {
                    if (this._state === State.ON) {
                        this._hideFloatingMiniPanel();
                        this._preparePermanentMode(false);
                        this._state = State.AUTO;
                        this._sets.set_int('state', this._state);
                        this._fmpQuickToggle.subtitle =
                            this._autoItem.label.text;
                        this._autoItem.setOrnament(PopupMenu.Ornament.CHECK);
                        this._permItem.setOrnament(PopupMenu.Ornament.NONE);
                        this._permItem.reactive = false;
                        Main.notify(
                            'Floating Mini Panel switched into Auto Mode,',
                            'because ' + phext + ' is active!'
                        );
                    } else {
                        this._permItem.reactive = false;
                        Main.notify(
                            'Floating Mini Panel disabed Permanent Mode,',
                            'because ' + phext + ' is active!'
                        );
                    }
                }
            }
        }

        _tmpHide() {
            // Hide this for 5 sec.
            this.hide();
            if (this._timeoutId2) {
                GLib.Source.remove(this._timeoutId2);
                this._timeoutId2 = null;
            }
            this._timeoutId2 = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                5000,
                () => {
                    if (
                        // Bug fix v5
                        Utils.panelBoxHidden() &&
                        !OVERVIEW.visible
                    )
                        this.show();
                    this._timeoutId2 = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        }

        _showFloatingMiniPanel() {
            // If in Permanent Mode hide the Main Panel
            if (this._state !== State.AUTO) {
                let priMonGeo = Utils.priMonitorGeometry();
                PANELBOX.set_position(
                    priMonGeo.x,
                    Math.abs(priMonGeo.y - priMonGeo.y) - PANELBOX.height
                );
            }

            // Show this with animation
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
            // Hide this w/o animation
            this.visible = false;

            // If in Permanent Mode show the Main Panel
            if (this._state !== State.AUTO) {
                let priMonGeo = Utils.priMonitorGeometry();
                PANELBOX.set_position(priMonGeo.x, priMonGeo.y);
            }
        }

        // If this was moved, its width changed or the workarea has changed-----
        // Refactored and support for AUTO POSITION (Issue #5)
        _relocate(setAlign) {
            // Get monitor geometry where this is on
            let rect = new Mtk.Rectangle({
                x: this.x,
                y: this.y,
                width: this.width,
                height: this.height,
            });
            let monitor = DISPLAY.get_monitor_index_for_rect(rect);
            if (monitor < 0) monitor = DISPLAY.get_primary_monitor();
            let geom = DISPLAY.get_monitor_geometry(monitor);

            let align = Alignment.NONE;

            if (rect.y < geom.y) {
                rect.y = geom.y;
                align |= Alignment.TOP;
            }

            let max_y = geom.y + geom.height - rect.height;
            if (rect.y > max_y) {
                rect.y = max_y;
                align |= Alignment.BOTTOM;
            }

            if (rect.x < geom.x) {
                rect.x = geom.x;
                align |= Alignment.LEFT;
            }

            let max_x = geom.x + geom.width - rect.width;
            if (rect.x > max_x) {
                rect.x = max_x;
                align |= Alignment.RIGHT;
            }

            if (setAlign) {
                this._sets.set_int('aligned', align);
            } else {
                align = this._sets.get_int('aligned');
                if (align & Alignment.TOP) rect.y = geom.y;
                if (align & Alignment.BOTTOM) rect.y = max_y;
                if (align & Alignment.LEFT) rect.x = geom.x;
                if (align & Alignment.RIGHT) rect.x = max_x;
                if (this[this.orientStr]) {
                    if (align & Alignment.CENTER) rect.y = geom.y + (geom.height - rect.height) / 2;
                } else {
                    // BUG: 'max_x / 2' which is '(geom.x + geom.width - rect.width) / 2' was used !!!
                    if (align & Alignment.CENTER) rect.x = geom.x + (geom.width - rect.width) / 2;
                }
            }

            this._adjustBorder(align);

            this.set_position(rect.x, rect.y);
            this._sets.set_int('pos-x', rect.x);
            this._sets.set_int('pos-y', rect.y);
        }

        _adjustBorder(align) {
            switch (align) {
                case Alignment.LEFT | Alignment.TOP:
                    this.style = 'border-radius: 0px 0px 15px 0px;';
                    break;
                case Alignment.LEFT | Alignment.BOTTOM:
                    this.style = 'border-radius: 0px 15px 0px 0px;';
                    break;
               case Alignment.RIGHT | Alignment.TOP:
                    this.style = 'border-radius: 0px 0px 0px 15px;';
                    break;
                case Alignment.RIGHT | Alignment.BOTTOM:
                    this.style = 'border-radius: 15px 0px 0px 0px;';
                    break;
                case Alignment.TOP:
                case Alignment.TOP | Alignment.CENTER:
                    this.style = 'border-radius: 0px 0px 15px 15px;';
                    break;
                case Alignment.BOTTOM:
                case Alignment.BOTTOM | Alignment.CENTER:
                    this.style = 'border-radius: 15px 15px 0px 0px;';
                    break;
                case Alignment.LEFT:
                case Alignment.LEFT | Alignment.CENTER:
                    this.style = 'border-radius: 0px 15px 15px 0px;';
                    break;
                case Alignment.RIGHT:
                case Alignment.RIGHT | Alignment.CENTER:
                    this.style = 'border-radius: 15px 0px 0px 15px;';
                    break;
                default:
                    this.style = null;
                    break;
            }
        }

        destroy() {
            this._hideFloatingMiniPanel();

            this._ctlBtn.destroy();
            this._indsDrawer.destroy();
            this._dateBtn.destroy();
            this._quickBtn.destroy();

            if (this._timeoutId1) {
                GLib.Source.remove(this._timeoutId1);
                this._timeoutId1 = null;
            }

            if (this._timeoutId2) {
                GLib.Source.remove(this._timeoutId2);
                this._timeoutId2 = null;
            }

            PANELBOX.disconnect(this._pvConId);
            this._pvConId = null;

            if (this._lsConId) {
                LAYOUTMANAGER.disconnect(this._lsConId);
                this._lsConId = null;
            }

            this._loginManager.disconnect(this._lpConId);
            this._lpConId = null;

            Main.extensionManager.disconnect(this._meConId);
            this._meConId = null;

            DISPLAY.disconnect(this._wcConId);
            this._wcConId = null;

            OVERVIEW.disconnect(this._ovConId1);
            this._ovConId1 = null;

            OVERVIEW.disconnect(this._ovConId2);
            this._ovConId2 = null;

            this._fmpQuickIndicator.quickSettingsItems.forEach(item =>
                item.destroy()
            );
            this._fmpQuickIndicator.destroy();
            this._fmpQuickIndicator = null;

            LAYOUTMANAGER.removeChrome(this);

            // Issue #10
            if (this._enaUnredirectFunc !== null) {
                if (shellVersion > 47) {
                    global.compositor.enable_unredirect = this._enaUnredirectFunc;
                    global.compositor.enable_unredirect();
                } else {
        	            Meta.enable_unredirect_for_display = this._enaUnredirectFunc;
    	                Meta.enable_unredirect_for_display(global.display);
    	            }
	            this._enaUnredirectFunc = null;
	        }

            this._preparePermanentMode(false);

            super.destroy();
        }
    }
);

export default class FloatingMiniPanelExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        startupComplete = false;
    }

    enable() {            
        this._floatingMiniPanel = new FloatingMiniPanel(this.getSettings());
    }

    disable() {
        this._floatingMiniPanel.destroy();
        this._floatingMiniPanel = null;
    }
}
