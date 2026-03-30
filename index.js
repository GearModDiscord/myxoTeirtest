// Minecraft Tier Test Discord Bot (File-based JSON DB, Railway-ready)
// Features: tickets, auto tester assignment, promotion/demotion, leaderboard, slash commands

const { Client, GatewayIntentBits, PermissionsBitField, ChannelType, ActionRowBuilder, StringSelectMenuBuilder, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = '1484988108641538250';
const GUILD_ID = '1487204562019549305';
const STAFF_ROLE_ID = '1487205010604294165';
const CATEGORY_ID = '1487205316742479933';

const DATA_FILE = './data.json';
const TIER_ORDER = ['LT1','LT2','HT1','HT2','HT3'];
const TIER_ROLES = { LT1:'ROLE_ID', LT2:'ROLE_ID', HT1:'ROLE_ID', HT2:'ROLE_ID', HT3:'ROLE_ID' };
const PROMOTION_SCORE = 20;
const DEMOTION_SCORE = -10;

function loadData(){
  if(!fs.existsSync(DATA_FILE)) return { players:{}, queue:[], testers:{} };
  return JSON.parse(fs.readFileSync(DATA_FILE));
}

function saveData(data){
  fs.writeFileSync(DATA_FILE, JSON.stringify(data,null,2));
}

const client = new Client({ intents:[GatewayIntentBits.Guilds] });

// Slash commands
const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('Send ticket dropdown panel'),
  new SlashCommandBuilder().setName('available').setDescription('Toggle tester availability'),
  new SlashCommandBuilder().setName('leaderboard').setDescription('View PvP leaderboard'),
].map(cmd=>cmd.toJSON());

const rest = new REST({ version:'10' }).setToken(TOKEN);
(async()=>{ await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{ body:commands });})();

client.once('ready',()=>{ console.log(`Logged in as ${client.user.tag}`); });

async function checkPromotion(member,data){
  const player = data.players[member.id];
  if(!player) return;
  const index = TIER_ORDER.indexOf(player.tier);
  if(player.score >= PROMOTION_SCORE && index < TIER_ORDER.length-1){
    player.tier = TIER_ORDER[index+1]; player.score=0;
    await member.roles.add(TIER_ROLES[player.tier]);
  }
  if(player.score <= DEMOTION_SCORE && index>0){
    player.tier = TIER_ORDER[index-1]; player.score=0;
    await member.roles.add(TIER_ROLES[player.tier]);
  }
  saveData(data);
}

async function assignTester(channel,data){
  const available = Object.entries(data.testers).filter(([id,avail])=>avail).map(([id])=>id);
  if(!available.length){ channel.send('No testers available currently.'); return; }
  const testerId = available[Math.floor(Math.random()*available.length)];
  channel.send(`Assigned tester: <@${testerId}>`);
}

client.on('interactionCreate',async interaction=>{
  const data = loadData();

  if(interaction.isChatInputCommand()){
    if(interaction.commandName==='panel'){
      const menu = new StringSelectMenuBuilder()
        .setCustomId('ticket_menu')
        .setPlaceholder('Request PvP Tier Test')
        .addOptions([{label:'Join Test Queue',value:'queue_join'}]);
      const row = new ActionRowBuilder().addComponents(menu);
      interaction.reply({ content:'Click below to join queue', components:[row] });
    }
    if(interaction.commandName==='available'){
      const id = interaction.user.id;
      data.testers[id] = !data.testers[id];
      saveData(data);
      interaction.reply(`Availability: ${data.testers[id] ? 'ON':'OFF'}`);
    }
    if(interaction.commandName==='leaderboard'){
      const players = Object.entries(data.players).sort((a,b)=>b[1].score-a[1].score).slice(0,10);
      let board='Leaderboard:\n\n';
      players.forEach(([id,p],i)=>{ board+=`${i+1}. <@${id}> (${p.score})\n`; });
      interaction.reply(board);
    }
  }

  if(interaction.isStringSelectMenu() && interaction.customId==='ticket_menu'){
    if(!data.players[interaction.user.id]) data.players[interaction.user.id]={ tier:'LT1', score:0 };
    data.queue.push(interaction.user.id);
    saveData(data);

    const channel = await interaction.guild.channels.create({
      name:`test-${interaction.user.username}`,
      type:ChannelType.GuildText,
      parent:CATEGORY_ID,
      permissionOverwrites:[
        { id:interaction.guild.id, deny:[PermissionsBitField.Flags.ViewChannel] },
        { id:interaction.user.id, allow:[PermissionsBitField.Flags.ViewChannel] },
        { id:STAFF_ROLE_ID, allow:[PermissionsBitField.Flags.ViewChannel] }
      ]
    });

    await assignTester(channel,data);
    interaction.reply({ content:'Added to queue + tester assigned', ephemeral:true });
  }
});

const express = require('express');
const app = express();
app.get('/',(req,res)=>res.send('Bot running'));
app.listen(process.env.PORT||3000,()=>console.log('Dashboard running'));

client.login(TOKEN);
