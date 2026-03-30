// Minecraft Tier Test Discord Bot (Railway + MongoDB)
// Install: npm install discord.js express mongoose

const { Client, GatewayIntentBits, PermissionsBitField, ChannelType,
ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder, REST, Routes } = require("discord.js");
const express = require("express");
const mongoose = require("mongoose");

const TOKEN = process.env.TOKEN;
const MONGO_URI = process.env.MONGO_URI;

const CLIENT_ID = "1479616798847406090";
const GUILD_ID = "1472651115223847026";
const STAFF_ROLE_ID = "1472651115618242615";
const CATEGORY_ID = "1472662988732367083";

const TIER_ORDER = ["LT1","LT2","HT1","HT2","HT3"];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

mongoose.connect(MONGO_URI);

const Player = mongoose.model("Player", new mongoose.Schema({
  userId: String,
  tier: String,
  score: { type: Number, default: 0 }
}));

const Queue = mongoose.model("Queue", new mongoose.Schema({
  userId: String
}));

const Tester = mongoose.model("Tester", new mongoose.Schema({
  userId: String,
  available: Boolean
}));

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

async function assignTester(channel, guild) {
  const testers = await Tester.find({ available: true });

  if (!testers.length) {
    channel.send("No testers available currently.");
    return;
  }

  const tester = testers[Math.floor(Math.random() * testers.length)];
  channel.send(`Assigned tester: <@${tester.userId}>`);
}

client.on("interactionCreate", async interaction => {

  if (interaction.isChatInputCommand()) {

    if (interaction.commandName === "panel") {

      const menu = new StringSelectMenuBuilder()
        .setCustomId("ticket_menu")
        .setPlaceholder("Request PvP Tier Test")
        .addOptions([{
          label: "Join Test Queue",
          value: "queue_join"
        }]);

      const row = new ActionRowBuilder().addComponents(menu);

      interaction.reply({
        content: "Click below to join queue",
        components: [row]
      });
    }

    if (interaction.commandName === "available") {

      let tester = await Tester.findOne({ userId: interaction.user.id });

      if (!tester)
        tester = await Tester.create({
          userId: interaction.user.id,
          available: true
        });
      else tester.available = !tester.available;

      await tester.save();

      interaction.reply(`Availability: ${tester.available ? "ON" : "OFF"}`);
    }
  }

  if (interaction.isStringSelectMenu()) {

    if (interaction.customId === "ticket_menu") {

      await Queue.create({ userId: interaction.user.id });

      const channel = await interaction.guild.channels.create({
        name: `test-${interaction.user.username}`,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,

        permissionOverwrites: [
          { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel] },
          { id: STAFF_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel] }
        ]
      });

      await assignTester(channel, interaction.guild);

      interaction.reply({
        content: "Added to queue + tester assigned",
        ephemeral: true
      });
    }
  }
});

const commands = [
  new SlashCommandBuilder().setName("panel").setDescription("Send ticket dropdown panel"),
  new SlashCommandBuilder().setName("available").setDescription("Toggle tester availability")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

const app = express();

app.get("/", (req, res) => res.send("Bot running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Dashboard running"));

client.login(TOKEN);
