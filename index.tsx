/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyToClipboard } from "@utils/clipboard";
import definePlugin from "@utils/types";
import { ChannelStore, showToast } from "@webpack/common";

import { registerServer, TempVoiceServer, unregisterServer } from "../tempVoiceChannels";
import { PATTERNS as CORE_PATTERNS } from "../tempVoiceChannels/patterns";
import { rememberIds } from "../tempVoiceChannels/idStore";
import { lookupIds } from "../tempVoiceChannels/profileScanner";
import { ActivisionEntry, isPanel, parseActivision, parseLogs } from "./parsers";
import { PATTERNS } from "./patterns";
import { settings } from "./settings";

/**
 * Activision IDs the bot showed, by user, for this Discord session. Each reply replaces what a user had before,
 * since the bot's list is their current linked IDs. Used for the Copy ID menu and to keep the profile scan from repeating them.
 */
const botIds = new Map<string, string[]>();
/** Where these IDs came from, as shown in the Copy ID menu. */
const BOT_SOURCE = "V3NOM bot";

function rememberBotIds(entries: ActivisionEntry[] | null) {
    const byUser = Map.groupBy(entries ?? [], e => e.userId);
    for (const [userId, userEntries] of byUser) {
        const ids = userEntries.map(e => e.activisionId);
        botIds.set(userId, ids);
        rememberIds(userId, ids.map(id => ({ id, source: BOT_SOURCE })));
    }
    return entries;
}

/** Copies the first ID and mentions the rest, since a clipboard only holds one. */
async function copyIds(ids: string[], source: string) {
    await copyToClipboard(ids[0]);
    const rest = ids.slice(1);
    showToast({
        text: `Copied ${ids[0]}${source}${rest.length ? `. Also here: ${rest.join(", ")}` : ""}`,
        variant: "success",
        duration: rest.length ? 8000 : 4000
    });
}

const server: TempVoiceServer = {
    name: "CodWarzoneHelper",
    guildId: () => settings.store.guildId,
    botId: () => settings.store.botId,
    presets: () => settings.store.presets,
    profileIds: [CORE_PATTERNS.idKinds.activision],
    otherIds: userId => (botIds.get(userId) ?? []).map(id => ({ id, source: BOT_SOURCE })),
    knownIds: (_channelId, userId) => botIds.get(userId) ?? [],
    isPanel: m => isPanel(m.components),
    isCreatedNotice: (m, userId) => m.content.includes(PATTERNS.createdNotice) && CORE_PATTERNS.mention(userId).test(m.content),

    async applyPreset(api, channelId, preset) {
        await api.pause(1500, 2500);
        api.openChat();
        const panel = await api.waitForPanel();
        if (!panel) return api.fail("Voice panel not found.");

        // The bot's rename form also sets the channel status. With only a status, the name stays as it is,
        // so the check passes as soon as the form was sent.
        if (preset.name || preset.status) {
            const name = (preset.name || ChannelStore.getChannel(channelId)?.name || "").trim();
            await api.pause(1500, 2500);
            const renamed = await api.submitModal(panel, PATTERNS.buttons.rename, PATTERNS.modals.rename.id,
                { [PATTERNS.modals.rename.name]: name, [PATTERNS.modals.rename.status]: preset.status },
                () => ChannelStore.getChannel(channelId)?.name.trim() === name, "Rename");
            if (!renamed) return;
        }

        if (preset.limit) {
            const { limit } = preset;
            await api.pause(1500, 2500);
            const limited = await api.submitModal(panel, PATTERNS.buttons.limit, PATTERNS.modals.limit.id,
                { [PATTERNS.modals.limit.limit]: String(limit) },
                () => ChannelStore.getChannel(channelId)?.userLimit === limit, "Setting the user limit");
            if (!limited) return;
        }

        if (preset.privacy !== "unchanged") {
            await api.pause(1500, 2500);
            await api.clickButton(panel, preset.privacy === "private" ? PATTERNS.buttons.private : PATTERNS.buttons.public);
        }

        if (settings.store.clickPanelOnCreate) {
            await api.pause(2000, 3000);
            await api.clickButton(panel, PATTERNS.buttons.logs, parseLogs);
            await api.pause(2500, 3500);
            rememberBotIds(await api.clickButton(panel, PATTERNS.buttons.activision, parseActivision));
            await api.pause(800, 1200);
            api.scrollToBottom();
        }
    },

    async onJoinOthers(api, _channelId, others) {
        if (!settings.store.copyActivisionOnJoin) return;
        const panel = await api.waitForPanel();
        if (!panel) return;
        api.openChat();
        await api.pause(1500, 2500);
        const entries = rememberBotIds(await api.clickButton(panel, PATTERNS.buttons.activision, parseActivision));
        await api.pause(800, 1200);
        api.scrollToBottom();
        if (!entries) return api.fail("The bot didn't send any Activision IDs.");

        const found = entries.filter(e => others.includes(e.userId)).map(e => e.activisionId);
        if (found.length) return copyIds(found, "");

        // Nobody here linked an ID with the bot, so try their profiles instead.
        const guildId = settings.store.guildId;
        for (const userId of others) {
            const ids = await lookupIds(userId, guildId, CORE_PATTERNS.idKinds.activision);
            if (ids.length) return copyIds(ids, " (from their profile)");
        }
        showToast({ text: "Nobody else here has an Activision ID linked with the bot or in their profile." });
    }
};

export default definePlugin({
    name: "CodWarzoneHelper",
    description: "Creates preset voice channels on the German Warzone & MW4 server and handles the V3NOM voice panel for you.",
    authors: [
        { name: "Bluscream", id: 467777925790564352n },
        { name: "Claude Opus 5.5", id: 0n },
        { name: "Claude Fable 5.2", id: 0n }
    ],
    dependencies: ["TempVoiceChannels"],
    settings,

    start() {
        registerServer(server);
    },

    stop() {
        unregisterServer(server.name);
    }
});
