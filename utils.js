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

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const PANELBOX = Main.layoutManager.panelBox;
const DISPLAY = global.display;

// Helper function for PanelBox Visibility
export function panelBoxHidden() {
    let priMonGeo = priMonitorGeometry();
    if (
        PANELBOX.y < priMonGeo.y ||
        Math.abs(PANELBOX.translation_y) === PANELBOX.height ||
        Math.abs(PANELBOX.translation_x) === PANELBOX.width
    )
        return true;
    return false;
}

// Helper function for Primary Monitor Geometry
export function priMonitorGeometry() {
    let priMon = DISPLAY.get_primary_monitor();
    return DISPLAY.get_monitor_geometry(priMon);
}
