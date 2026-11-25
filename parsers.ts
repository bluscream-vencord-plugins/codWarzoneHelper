/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findComponent, getText } from "../tempVoiceChannels/components";
import { PATTERNS as CORE_PATTERNS } from "../tempVoiceChannels/patterns";
import { findIds } from "../tempVoiceChannels/profileScanner";
import { PATTERNS } from "./patterns";

export function isPanel(components: unknown[] | undefined) {
    return !!findComponent(components, PATTERNS.buttons.rename) && !!findComponent(components, PATTERNS.buttons.activision);
}

export interface LogEntry {
    joined: boolean;
    name: string;
    level: number | null;
    time: string;
    userId: string;
}

export function parseLogs(components: unknown[] | undefined): LogEntry[] | null {
    const text = getText(components);
    if (!text.includes(PATTERNS.logs.header)) return null;
    return [...text.matchAll(PATTERNS.logs.entry)].map(([, dot, label, time, userId]) => {
        const level = label.match(PATTERNS.logs.level);
        return {
            joined: dot === PATTERNS.logs.joined,
            name: level ? label.slice(0, level.index) : label,
            level: level ? Number(level[1]) : null,
            time,
            userId
        };
    });
}

export interface ActivisionEntry {
    userId: string;
    activisionId: string;
}

/**
 * One entry per ID. A user's block can hold several IDs ("Yami#7128746 Yami2#7128345"), which are split with the same
 * recognition the profile scanner uses; a block it can't read (e.g. an old name without a number) is kept as it is.
 */
export function parseActivision(components: unknown[] | undefined): ActivisionEntry[] | null {
    if (!findComponent(components, PATTERNS.buttons.editGamertag)) return null;
    return [...getText(components).matchAll(PATTERNS.activisionEntry)].flatMap(([, userId, block]) => {
        const ids = findIds(block, CORE_PATTERNS.idKinds.activision);
        return (ids.length ? ids : [block.trim()]).map(activisionId => ({ userId, activisionId }));
    });
}
