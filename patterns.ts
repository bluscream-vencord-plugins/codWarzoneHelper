/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Everything this plugin matches in V3NOM's messages, buttons and forms. */
export const PATTERNS = {
    /** Defaults for the hidden settings and the example preset. */
    defaults: {
        /** ⭐ Call of Duty: Warzone & MW4 | Deutschland */
        guildId: "500074231544152074",
        /** V3NOM */
        botId: "1515388147759059015",
        /** ⚡ REBIRTH VOICE › 「➕」Kanal erstellen! */
        creatorId: "1075199439704170516"
    },

    /** "🎮 Kanal erstellt von: @owner", posted in every new channel. */
    createdNotice: "Kanal erstellt von",

    buttons: {
        rename: "rename_button",
        limit: "limit_button",
        private: "private_button",
        public: "public_button",
        logs: "logs_button",
        activision: "activision_button",
        /** Only present in the bot's Activision IDs reply. */
        editGamertag: "editgamertag_button"
    },

    modals: {
        rename: { id: "rename_modal", name: "channel_name", status: "channel_status" },
        limit: { id: "limit_modal", limit: "channel_limit" }
    },

    logs: {
        header: "VOICE CHANNEL LOGS",
        /** "**`🟢` name 🔥103**\n-# `14:09:50` `userId`", 🟢 for a join and 🔴 for a leave. */
        entry: /\*\*`(🟢|🔴)` (.+?)\*\*\n-# `([\d:]+)` `(\d+)`/g,
        joined: "🟢",
        /** " 🔥103" at the end of a name: the user's level on the server. */
        level: / 🔥(\d+)$/
    },

    /**
     * Splits one user's code block into separate IDs ("Yami#7128746 Yami2#7128345"): at whitespace right after a
     * "#number". Names with spaces stay whole, since their spaces don't follow a number.
     */
    activisionBlockSplit: /(?<=#\d+)\s+/,

    /** "**… von <@userId>** ```cs\nName#1234567```" */
    activisionEntry: /von <@!?(\d+)>\*\*\s*```(?:\w+)?\n([^`]+?)\n?```/g
};
