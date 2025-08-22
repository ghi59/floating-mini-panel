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
//import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const PANEL = Main.panel;
const PANELBOX = Main.layoutManager.panelBox;
const STATUSAREA = PANEL.statusArea;
const LEFTBOX = PANEL._leftBox;
const CENTERBOX = PANEL._centerBox;
const RIGHTBOX = PANEL._rightBox;

const Box = {
    LEFT: 0,
    CENTER: 1,
    RIGHT: 2,
};

const IndicatorClone = GObject.registerClass(
    class IndicatorClone extends St.BoxLayout {
        constructor(parent, ind, role, box, pos, always) {
            super({
                name: 'extBtn',
                reactive: true,
                track_hover: true,
                style_class: 'button',
            });

            this._parent = parent;
            this._ind = ind;
            this._role = role;
            this._box = box;
            this._pos = pos;
            this._always = always;

            this._indChilds = [];
            this._indContainers = [];
            this._childs = [];
            this._containers = [];

            this._ind.connectObject('destroy', () => this.destroy(), this);

            this._ind.bind_property(
                'visible',
                this,
                'visible',
                GObject.BindingFlags.SYNC_CREATE
            );

            // Get indicator menu properties -----------------------------------
            if (this._ind.menu) {
                this._indActor = this._ind.menu.sourceActor;
                this._indArrow = this._ind.menu.arrowAlignment;

                this._ind.menu.connectObject(
                    'open-state-changed',
                    () => {
                        if (this.has_style_pseudo_class('active')) {
                            this.remove_style_pseudo_class('active');
                        } else {
                            this.add_style_pseudo_class('active');
                        }
                        return Clutter.EVENT_PROPAGATE;
                    },
                    this
                );
            } else {
                // Support for ArcMenu
                // If enabled during runtime overview has to be toggled
                // once to make the sourceActor work (I don't know why)!
                if (this._role === 'ArcMenu') {
                    this._indActor = this._ind.arcMenu.sourceActor;
                    this._indArrow = this._ind.arcMenu.arrowAlignment;
                    this._ind.arcMenu.connectObject(
                        'open-state-changed',
                        () => {
                            if (this.has_style_pseudo_class('active')) {
                                this.remove_style_pseudo_class('active');
                            } else {
                                this.add_style_pseudo_class('active');
                            }
                            return Clutter.EVENT_PROPAGATE;
                        },
                        this
                    );
                    this._ind.arcMenuContextMenu.connectObject(
                        'open-state-changed',
                        () => {
                            if (this.has_style_pseudo_class('active')) {
                                this.remove_style_pseudo_class('active');
                            } else {
                                this.add_style_pseudo_class('active');
                            }
                            return Clutter.EVENT_PROPAGATE;
                        },
                        this
                    );
                }
            }

            // Change / restore menu properties (sourceActor and arrowAlignment)
            // triggered by visibility (mapped)
            this.connect('notify::mapped', () => {
                this._toggleMenuProps(this.mapped);
            });

            // Connect actions -------------------------------------------------
            this.connect('button-press-event', (obj, event) => {
                if (event.get_button() === 2) {
                    // AppIndicator roles are dynamic, so we cant handle them!
                    if (!this._role.startsWith('appindicator'))
                        this._parent.makeAlways(this);
                } else {
                    if (!this._role.startsWith('appindicator')) {
                        this._ind.emit('event', event);
                    } else {
                        this._ind.vfunc_button_press_event(event);
                    }
                }
                return Clutter.EVENT_STOP;
            });

            this.connect('button-release-event', (obj, event) => {
                if (!this._role.startsWith('appindicator')) {
                    this._ind.emit('event', event);
                } else {
                    // No Support for Shell.TrayIcon
                    // if (this._indContainers[0] instanceof Shell.TrayIcon) {
                    // this._indContainer[0].firstChild.click(event);
                    // }
                }
                return Clutter.EVENT_STOP;
            });

            // Get the indicator's childs --------------------------------------
            // Wait for AppIndicators to settle! Not needed for normal
            // Extension Indicators, but for some like Freon. (ca. 500ms)

            if (this._timeoutId) {
                GLib.Source.remove(this._timeoutId);
                this._timeoutId = null;
            }
            let timeout = 0;
            if (
                this._role.startsWith('appindicator') ||
                this._role.startsWith('freonMenu')
            ) {
                timeout = 500;
                // PanelBox.visible is important for AppIndicators to show up
                PANELBOX.visible = true;
            }
            this._timeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                timeout,
                () => {
                    this._containers.push(this);
                    this._indContainers.push(this._ind);
                    this._findIndChilds(
                        this._indContainers[0],
                        this._containers[0]
                    );
                    this._timeoutId = null;
                    return GLib.SOURCE_REMOVE;
                }
            );
        }

        // Find indicator childs and add containers recursively ----------------
        _findIndChilds(indContainer, container) {
            let childs = indContainer.get_children();
            for (let c = 0; c < childs.length; c++) {
                // Maybe test only for St.BoxLayout?
                if (
                    childs[c].get_n_children() > 0 &&
                    !(childs[c] instanceof Clutter.Content) &&
                    !(childs[c] instanceof St.Icon) &&
                    !(childs[c] instanceof St.Label)
                ) {
                    // Add containers to this, bind properties and
                    // connect signals
                    this._indContainers.push(childs[c]);
                    // Index 'i' is equal for indContainers and containers,
                    // so we only have to get it once and use it for both!
                    let i = this._indContainers.length - 1;
                    this._containers.push(
                        new St.BoxLayout({
                            x_expand: true,
                            x_align: Clutter.ActorAlign.FILL,
                        })
                    );
                    container.add_child(this._containers[i]);
                    this._indContainers[i].bind_property(
                        'visible',
                        this._containers[i],
                        'visible',
                        GObject.BindingFlags.SYNC_CREATE
                    );
                    this._indContainers[i].connectObject(
                        'child-added',
                        (actor, child) => {
                            this._addChildToContainer(
                                child,
                                this._containers[i]
                            );
                            return Clutter.EVENT_STOP;
                        },
                        'child-removed',
                        (actor, child) => {
                            this._removeChildFromContainer(
                                child,
                                this._containers[i]
                            );
                            return Clutter.EVENT_STOP;
                        },
                        this
                    );

                    // Recursion
                    this._findIndChilds(
                        this._indContainers[i],
                        this._containers[i]
                    );
                } else {
                    // No support for Shell.TrayIcon
                    if (childs[c].source) {
                        this._parent._alwaysBox.remove_child(this);
                    } else {
                        // Double check we found what we want and add it
                        // to the corresponding container.
                        if (
                            childs[c].content ||
                            childs[c].gicon ||
                            childs[c].text
                        )
                            this._addChildToContainer(
                                childs[c],
                                this._containers[this._containers.length - 1]
                            );
                    }
                }
            }
        }

        // Add indicator childs to their parent container ----------------------
        _addChildToContainer(child, container) {
            this._indChilds.push(child);
            let j = this._indChilds.indexOf(child);

            // No support for Shell.TrayIcon
            // Clutter.Actor (Legacy AppIndicator)
            //if (child.source) {
            //this._childs[j] = new Clutter.Clone({
            //    name: 'clone' + j.toString(),
            //    source: this._indChilds[j],
            //});
            //container.add_style_class_name('clone');
            //container.add_child(this._childs[j]);
            //}

            // Clutter.Actor (AppIndicator)
            if (child.content) {
                this._childs[j] = new St.Icon({
                    style_class: 'system-status-icon',
                });
                container.add_child(this._childs[j]);
                this._indChilds[j].bind_property(
                    'content',
                    this._childs[j],
                    'gicon',
                    GObject.BindingFlags.SYNC_CREATE
                );
                this._indChilds[j].bind_property(
                    'visible',
                    this._childs[j],
                    'visible',
                    GObject.BindingFlags.SYNC_CREATE
                );
            }

            // St.Icon (Extension or AppIndicator)
            if (child.gicon) {
                // HACK for not realized St.Labels e.g. System Monitor
                // to realize them, so a binding can be established.
                if (child.get_next_sibling() instanceof St.Label)
                    child.get_next_sibling().set_text('...');

                if (child.get_previous_sibling() instanceof St.Label) {
                    // Multiple icons with text in one container e.g. 'Vitals'
                    this._childs[j] = new St.Icon({
                        style_class: 'system-status-icon-2',
                    });
                } else {
                    // Single icon eventually with text in one container
                    this._childs[j] = new St.Icon({
                        style_class: 'system-status-icon',
                    });
                }
                container.add_child(this._childs[j]);
                this._indChilds[j].bind_property(
                    'gicon',
                    this._childs[j],
                    'gicon',
                    GObject.BindingFlags.SYNC_CREATE
                );
                if (container !== this) {
                    this._indChilds[j].bind_property(
                        'visible',
                        this._childs[j],
                        'visible',
                        GObject.BindingFlags.SYNC_CREATE
                    );
                }
            }

            // St.Label (Extension)
            if (child.text) {
                this._childs[j] = new St.Label({
                    y_expand: true,
                    y_align: Clutter.ActorAlign.CENTER,
                });
                container.add_child(this._childs[j]);
                this._indChilds[j].bind_property(
                    'text',
                    this._childs[j],
                    'text',
                    GObject.BindingFlags.SYNC_CREATE
                );
                this._indChilds[j].bind_property(
                    'visible',
                    this._childs[j],
                    'visible',
                    GObject.BindingFlags.SYNC_CREATE
                );
            }
        }

        // Rmove indicator childs ----------------------------------------------
        _removeChildFromContainer(child, container) {
            if (this._indChilds) {
                let j = this._indChilds.indexOf(child);
                if (this._childs[j]) {
                    container.remove_child(this._childs[j]);
                    this._childs[j] = null;
                    this._childs.splice(j, 1);
                    this._indChilds[j] = null;
                    this._indChilds.splice(j, 1);

                    //if (container.get_n_children() === 0) ... remove ?!
                }
            }
        }

        // Toggle indicator menu properties ------------------------------------
        _toggleMenuProps(on) {
            if (this._ind.menu) {
                if (on) {
                    this._ind.menu.sourceActor = this;
                    this._ind.menu._arrowAlignment = 0.5;
                } else {
                    this._ind.menu.sourceActor = this._indActor;
                    this._ind.menu.arrowAlignment = this._indArrow;
                }
            } else {
                // Support for ArcMenu
                if (this._ind.arcMenu) {
                    if (on) {
                        this._ind.arcMenu.sourceActor = this;
                        this._ind.arcMenu._arrowAlignment = 0.5;
                        this._ind.arcMenuContextMenu.sourceActor = this;
                        this._ind.arcMenuContextMenu._arrowAlignment = 0.5;
                    } else {
                        this._ind.arcMenu.sourceActor = this._indActor;
                        this._ind.arcMenu.arrowAlignment = this._indArrow;
                        this._ind.arcMenuContextMenu.sourceActor =
                            this._indActor;
                        this._ind.arcMenuContextMenu.arrowAlignment =
                            this._indArrow;
                    }
                }
            }
        }

        destroy() {
            if (this._timeoutId) {
                GLib.Source.remove(this._timeoutId);
                this._timeoutId = null;
            }

            if (this._parent._cloned) {
                this._parent._cloned.splice(
                    this._parent._cloned.indexOf(this._ind, 1)
                );
            }

            if (this.get_parent()) {
                this.get_parent().remove_child(this);
            }

            this._toggleMenuProps(false);

            this._parent = null;
            this._ind = null;
            this._role = null;
            this._box = null;
            this._pos = null;
            this._always = false;

            this._indChilds = null;
            this._indContainers = null;
            this._indActor = null;
            this._indArrow = null;
            this._childs = null;
            this._containers = null;

            super.destroy();
        }
    }
);

export const IndicatorsDrawer = GObject.registerClass(
    class IndicatorsDrawer extends St.BoxLayout {
        constructor(parent, sets) {
            super({
                name: 'IndicatorsDrawer',
            });

            this._parent = parent;
            this._sets = sets;
            this._open = this._sets.get_boolean('open');
            this._always = this._sets.get_strv('always');

            this._cloned = [];

            // Drawer Box ------------------------------------------------------
            this._drawerBox = new St.BoxLayout({
                name: 'drawerBox',
                x_expand: true,
                visible: this._open,
            });
            this.add_child(this._drawerBox);

            // Content Box -----------------------------------------------------
            this._contentBox = new St.BoxLayout({
                name: 'contentBox',
                x_expand: true,
            });
            this._drawerBox.add_child(this._contentBox);

            // Divider Box -----------------------------------------------------
            this._dividerBox = new St.BoxLayout({
                name: 'dividerBox',
                width: 1,
                style_class: 'divider',
            });
            this._drawerBox.add_child(this._dividerBox);

            // Always Box ------------------------------------------------------
            this._alwaysBox = new St.BoxLayout({
                name: 'alwaysBox',
                x_expand: true,
            });
            this.add_child(this._alwaysBox);

            // Show DividerBox between DrawerBox and AlwaysBox only if
            // ContentBox and AlwaysBox are not empty.
            this._alwaysBox.bind_property_full(
                'width',
                this._dividerBox,
                'opacity',
                GObject.BindingFlags.DEFAULT,
                () => {
                    if (
                        this._alwaysBox.width > 1 &&
                        this._contentBox.width > 1
                    ) {
                        return [Number, 255];
                    } else {
                        return [Number, 0];
                    }
                },
                null
            );

            // Start collecting Indicators -------------------------------------
            let orgInds = null;

            // Clone indicators which are already realized
            orgInds = LEFTBOX.get_children();
            for (let i = 0; i < orgInds.length; i++) {
                this._cloneIndicators(Box.LEFT, orgInds[i]);
            }
            orgInds = CENTERBOX.get_children();
            for (let i = 0; i < orgInds.length; i++) {
                this._cloneIndicators(Box.CENTER, orgInds[i]);
            }
            orgInds = RIGHTBOX.get_children();
            for (let i = 0; i < orgInds.length; i++) {
                this._cloneIndicators(Box.RIGHT, orgInds[i]);
            }

            // Start listeners for indicators which will be realized in future
            this._plConId = LEFTBOX.connect('child-added', (actor, child) => {
                this._cloneIndicators(Box.LEFT, child);
                return Clutter.EVENT_STOP;
            });
            this._pcConId = CENTERBOX.connect('child-added', (actor, child) => {
                this._cloneIndicators(Box.CENTER, child);
                return Clutter.EVENT_STOP;
            });
            this._prConId = RIGHTBOX.connect('child-added', (actor, child) => {
                this._cloneIndicators(Box.RIGHT, child);
                return Clutter.EVENT_STOP;
            });
        }

        // Helper function to insert child into box at correct position.
        _insertCloneIntoBox(clone, box) {
            let childs = box.get_children();
            if (childs.length === 0 || box.lastChild._pos < clone._pos) {
                box.add_child(clone);
            } else {
                for (let c = 0; c < childs.length; c++) {
                    if (childs[c]._pos > clone._pos) {
                        box.insert_child_at_index(clone, c);
                        break;
                    }
                }
            }
            if (clone.get_parent() !== box) box.add_child(clone);
        }

        // Start cloning indicators --------------------------------------------
        _cloneIndicators(box, child) {
            if (
                // this._ind is null error of user 'from the 51st state'!
                // I am not sure if this is realy neccessary!
                child.firstChild &&
                !this._cloned.includes(child.firstChild) &&
                child.firstChild !== STATUSAREA['activities'] &&
                child.firstChild !== STATUSAREA['dateMenu'] &&
                child.firstChild !== STATUSAREA['quickSettings']
            ) {
                this._cloned.push(child.firstChild);

                // Calculate real position of indicator in panel and ensure.
                let l = LEFTBOX.get_children();
                let c = CENTERBOX.get_children();
                let r = RIGHTBOX.get_children();
                let a = l.concat(c, r);
                a.splice(a.indexOf(STATUSAREA['activities'].get_parent()), 1);
                a.splice(a.indexOf(STATUSAREA['dateMenu'].get_parent()), 1);
                a.splice(
                    a.indexOf(STATUSAREA['quickSettings'].get_parent()),
                    1
                );
                let pos = a.indexOf(child);
                let clones = this._contentBox.get_children();
                for (let clone of clones)
                    clone._pos = a.indexOf(clone._ind.get_parent());

                // Get indicator role from statusarea
                let role = '';
                for (role in STATUSAREA) {
                    if (child.firstChild === STATUSAREA[role]) {
                        break;
                    }
                }

                // Get 'always' state of indicator
                let alwaysRoles = this._sets.get_strv('always');
                let always = alwaysRoles.includes(role);

                // Create clone of indicator
                let clone = new IndicatorClone(
                    this,
                    child.firstChild,
                    role,
                    box,
                    pos,
                    always
                );
                // Roles of AppIndicators are dynamic, so I show them always.
                // I did not find any stable value in all checked apps!!!
                // If this is unwanted someone can disable AppIndicators support
                // in Gnome Extension Managers, or if possible in the app!
                if (always || role.startsWith('appindicator')) {
                    this._insertCloneIntoBox(clone, this._alwaysBox);
                } else {
                    this._insertCloneIntoBox(clone, this._contentBox);
                }
            }
        }

        // Open / close Drawer Box ---------------------------------------------
        toggle() {
            let w = this._drawerBox.width;
            if (!this._drawerBox.visible) {
                // Move back if possible
                if (this._parent.x - w > 0) {
                    let new_x = this._sets.get_int('pos-x') - w;
                    this._parent.remove_all_transitions();
                    this._parent.ease({
                        x: new_x,
                        duration: 250,
                        mode: Clutter.AnimationMode.EASE_LINEAR,
                        onComplete: () => {
                            this._moveback = true;
                        },
                    });
                }
                // Open Drawer
                this._drawerBox.remove_all_transitions();
                this._drawerBox.width = 0;
                this._drawerBox.opacity = 0;
                this._drawerBox.visible = true;
                this._drawerBox.ease({
                    width: w,
                    opacity: 255,
                    duration: 250,
                    mode: Clutter.AnimationMode.EASE_LINEAR,
                    onComplete: () => {
                        this._drawerBox.width = -1;
                        this._sets.set_boolean('open', true);
                    },
                });
            } else {
                // Close Drawer
                this._drawerBox.remove_all_transitions();
                this._drawerBox.ease({
                    width: 0,
                    opacity: 0,
                    duration: 250,
                    mode: Clutter.AnimationMode.EASE_LINEAR,
                    onComplete: () => {
                        this._drawerBox.visible = false;
                        this._drawerBox.width = -1;
                        this._sets.set_boolean('open', false);
                    },
                });
                // Move back if neccessary
                if (this._moveback) {
                    let new_x = this._sets.get_int('pos-x') + w;
                    this._parent.remove_all_transitions();
                    this._parent.ease({
                        x: new_x,
                        duration: 250,
                        mode: Clutter.AnimationMode.EASE_LINEAR,
                        onComplete: () => {
                            this._moveback = false;
                        },
                    });
                }
            }
        }

        // Move clones to Always Box and vice versa ----------------------------
        makeAlways(clone) {
            if (clone._always) {
                this._alwaysBox.remove_child(clone);
                this._insertCloneIntoBox(clone, this._contentBox);
                this._always.splice(this._always.indexOf(clone._role), 1);
            } else {
                this._contentBox.remove_child(clone);
                this._insertCloneIntoBox(clone, this._alwaysBox);
                this._always.push(clone._role);
            }
            this._drawerBox.width = -1;
            clone._always = !clone._always;
            this._sets.set_strv('always', this._always);
        }

        destroy() {
            this._cloned = null;
            if (this._plConId) {
                LEFTBOX.disconnect(this._plConId);
                this._plConId = null;
            }
            if (this._pcConId) {
                CENTERBOX.disconnect(this._pcConId);
                this._pcConId = null;
            }
            if (this._prConId) {
                RIGHTBOX.disconnect(this._prConId);
                this._prConId = null;
            }
        }
    }
);
