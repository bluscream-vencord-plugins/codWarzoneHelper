# CodWarzoneHelper

Equicord user plugin for the "⭐ Call of Duty: Warzone & MW4 | Deutschland" Discord server and its V3NOM temp voice bot. Built on [TempVoiceChannels](https://github.com/bluscream-vencord-plugins/tempVoiceChannels), which it needs.

## Features

- **Presets** that create a channel and set its name, status, user limit and visibility through the bot's own panel and forms.
- **After creating a channel,** clicks Logs and Activision IDs in the voice panel (optional).
- **Joining someone else's channel** fetches the Activision IDs of the people in it and copies the first one to your clipboard (optional).
- **Getting back in:** the bot doesn't let you back into your own channel once it's private or full. Before you leave a channel you own (the bot gives its owner a personal Connect permission, which moves along on transfer), it clicks Public if the channel is private, and raises the user limit to the number of people in it if that's lower, so there's room for you.
- **Parsers** for the bot's voice logs and Activision ID replies.

Everything shared (menus, toolbox, delays, manual creation) is described in the TempVoiceChannels README.

## Install

Clone this repo **and** [TempVoiceChannels](https://github.com/bluscream-vencord-plugins/tempVoiceChannels) into `src/userplugins`, next to each other, then rebuild Equicord:

```sh
cd src/userplugins
git clone https://github.com/bluscream-vencord-plugins/tempVoiceChannels
git clone https://github.com/bluscream-vencord-plugins/codWarzoneHelper
```

Update both with `git pull` in their folders.
