/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Logger } from "@utils/Logger";
import definePlugin from "@utils/types";
import { ChannelStore, showToast, UserStore, VoiceStateStore } from "@webpack/common";

import { registerServer, TempVoiceApi, TempVoiceServer, unregisterServer } from "../tempVoiceChannels";
import { copyText } from "../tempVoiceChannels/clipboard";
import { rememberIds } from "../tempVoiceChannels/idStore";
import { PATTERNS as CORE_PATTERNS } from "../tempVoiceChannels/patterns";
import { lookupIds } from "../tempVoiceChannels/profileScanner";
import { ActivisionEntry, isPanel, parseActivision, parseLogs } from "./parsers";
import { PATTERNS } from "./patterns";
import { settings } from "./settings";

const logger = new Logger("CodWarzoneHelper");

/** Where these IDs came from, as shown in the Copy ID menu. */
const BOT_SOURCE = "V3NOM bot";

/**
 * Activision IDs the bot showed, by user, for this Discord session. Each reply replaces what a user had before,
 * since the bot's list is their current linked IDs. Used for the Copy ID menu.
 */
const botIds = new Map<string, string[]>();
/** The same, by the channel the bot showed them in, so the profile scan only leaves out what you saw there. */
const shownIn = new Map<string, Map<string, string[]>>();

function rememberBotIds(channelId: string, entries: ActivisionEntry[] | null) {
    const shown = new Map<string, string[]>();
    for (const [userId, userEntries] of Map.groupBy(entries ?? [], e => e.userId)) {
        const ids = userEntries.map(e => e.activisionId);
        botIds.set(userId, ids);
        shown.set(userId, ids);
        rememberIds(userId, ids.map(id => ({ id, source: BOT_SOURCE })));
    }
    shownIn.clear();
    shownIn.set(channelId, shown);
    return entries;
}

interface FoundId {
    userId: string;
    id: string;
}

const displayName = (userId: string) => {
    const user = UserStore.getUser(userId);
    return user?.globalName ?? user?.username ?? "someone";
};

/** Copies the first ID and mentions the rest, since a clipboard only holds one. */
async function copyIds(found: FoundId[], fromProfile: boolean) {
    const unique = [...new Map(found.map(f => [f.id.toLowerCase(), f])).values()];
    const [first, ...rest] = unique;
    try {
        await copyText(first.id);
    } catch (err) {
        logger.error("Copying to the clipboard failed", err);
        return showToast({ text: `Couldn't copy ${first.id} to the clipboard.`, variant: "critical" });
    }
    const also = rest.map(f => `${f.id} (${displayName(f.userId)})`).join(", ");
    showToast({
        text: `Copied ${first.id} of ${displayName(first.userId)}${fromProfile ? " from their profile" : ""}${also ? `. Also here: ${also}` : ""}`,
        variant: "success",
        duration: rest.length ? 8000 : 4000
    });
}

/** Everyone else still in the channel, in the order they were found when you joined. */
function stillHere(channelId: string, others: string[]) {
    const present = VoiceStateStore.getVoiceStatesForChannel(channelId);
    return others.filter(userId => userId in present);
}

/** Nobody here linked an ID with the bot, or it didn't answer: try their profiles instead, one at a time. */
async function copyFromProfiles(api: TempVoiceApi, channelId: string, others: string[]) {
    const { guildId } = settings.store;
    for (const userId of stillHere(channelId, others)) {
        const ids = await lookupIds(userId, guildId, CORE_PATTERNS.idKinds.activision);
        if (ids.length) return copyIds(ids.map(id => ({ userId, id })), true);
        await api.pause(800, 1500);
    }
    showToast({ text: "Nobody else here has an Activision ID linked with the bot or in their profile." });
}

const server: TempVoiceServer = {
    name: "CodWarzoneHelper",
    guildId: () => settings.store.guildId,
    botId: () => settings.store.botId,
    presets: () => settings.store.presets,
    profileIds: [CORE_PATTERNS.idKinds.activision],
    otherIds: userId => (botIds.get(userId) ?? []).map(id => ({ id, source: BOT_SOURCE })),
    knownIds: (channelId, userId) => shownIn.get(channelId)?.get(userId) ?? [],
    isPanel: m => isPanel(m.components),
    isCreatedNotice: (m, userId) => m.content.includes(PATTERNS.createdNotice) && CORE_PATTERNS.mention(userId).test(m.content),

    async applyPreset(api, channelId, preset) {
        await api.pause(1500, 2500);
        api.openChat();
        const panel = await api.waitForPanel();
        if (!panel) return api.fail("Voice panel not found.");

        // The bot's rename form also sets the channel status. Without a preset name the name field keeps the bot's
        // prefilled value, so the channel isn't renamed to itself; then there's no name to check, sending the form is enough.
        if (preset.name || preset.status) {
            const name = preset.name.trim();
            const { rename } = PATTERNS.modals;
            await api.pause(1500, 2500);
            const renamed = await api.submitModal(panel, PATTERNS.buttons.rename, rename.id,
                { ...(name ? { [rename.name]: name } : {}), [rename.status]: preset.status },
                () => !name || ChannelStore.getChannel(channelId)?.name.trim() === name, "Rename");
            if (!renamed) return;
        }

        if (preset.limit) {
            const { limit } = preset;
            await api.pause(3000, 3500);
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
            rememberBotIds(channelId, await api.clickButton(panel, PATTERNS.buttons.activision, parseActivision));
            await api.pause(800, 1200);
            api.scrollToBottom();
        }
    },

    async onJoinOthers(api, channelId, others) {
        if (!settings.store.copyActivisionOnJoin) return;
        const panel = await api.waitForPanel();
        if (!panel) return copyFromProfiles(api, channelId, others);
        api.openChat();
        await api.pause(1500, 2500);
        const entries = rememberBotIds(channelId, await api.clickButton(panel, PATTERNS.buttons.activision, parseActivision));
        await api.pause(800, 1200);
        api.scrollToBottom();

        const here = stillHere(channelId, others);
        const found = (entries ?? []).filter(e => here.includes(e.userId)).map(e => ({ userId: e.userId, id: e.activisionId }));
        if (found.length) return copyIds(found, false);
        if (!entries) showToast({ text: "The bot didn't send any Activision IDs, trying their profiles." });
        await copyFromProfiles(api, channelId, others);
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
        botIds.clear();
        shownIn.clear();
    }
});
