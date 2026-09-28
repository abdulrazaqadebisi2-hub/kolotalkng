const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {cors:{origin:"*"}, maxHttpBufferSize: 1e7});
app.use(express.static(__dirname));

let users = {};
let messages = {};
let groupMessages = {};
let groups = {
  'general': {id:'general', name:'Naija General 🇳🇬', type:'community', members:[], desc:'Everyone', avatar:'🇳🇬'}
};

io.on('connection', socket=>{
  socket.on('joinKolo', user=>{
    users[socket.id] = {...user, sid:socket.id};
    io.emit('users', Object.values(users));
    io.emit('groups', Object.values(groups));
    Object.keys(groups).forEach(g=>socket.join(g));
  });

  socket.on('createGroup', data=>{
    const id=data.name.toLowerCase().replace(/\s+/g,'_')+'_'+Date.now();
    groups[id]={id, name:data.name, type:data.type, desc:data.desc, avatar:'👨‍👩‍👧‍👦'};
    groupMessages[id]=[]; io.emit('groups', Object.values(groups));
  });

  socket.on('joinGroup', gid=>{socket.join(gid); socket.emit('groupMsgs',{gid,msgs:groupMessages[gid]||[]});});
  socket.on('loadPrivate', chatId=>{socket.emit('privateMsgs',{chatId,msgs:messages[chatId]||[]});});

  socket.on('sendPrivate', d=>{
    const chatId=[d.sender,d.receiver].sort().join('_');
    if(!messages[chatId]) messages[chatId]=[];
    messages[chatId].push({...d,time:Date.now()});
    for(let sid in users){
      if(users[sid].uid===d.sender || users[sid].uid===d.receiver){
        io.to(sid).emit('newPrivate',{chatId,msg:messages[chatId].slice(-1)[0]});
      }
    }
  });

  socket.on('sendGroup', d=>{
    if(!groupMessages[d.gid]) groupMessages[d.gid]=[];
    groupMessages[d.gid].push({...d,time:Date.now()});
    io.to(d.gid).emit('newGroupMsg',{gid:d.gid,msg:groupMessages[d.gid].slice(-1)[0]});
  });

  // REAL CALL SIGNALING
  socket.on('callUser', data=>{
    for(let sid in users){
      if(users[sid].uid===data.to){
        io.to(sid).emit('incomingCall',{from:data.from, fromName:data.fromName, type:data.callType, offer:data.offer});
      }
    }
  });

  socket.on('answerCall', data=>{
    for(let sid in users){
      if(users[sid].uid===data.to){
        io.to(sid).emit('callAnswered',{answer:data.answer});
      }
    }
  });

  socket.on('iceCandidate', data=>{
    for(let sid in users){
      if(users[sid].uid===data.to){
        io.to(sid).emit('iceCandidate',{candidate:data.candidate});
      }
    }
  });

  socket.on('endCall', data=>{
    for(let sid in users){
      if(users[sid].uid===data.to || users[sid].uid===data.from){
        io.to(sid).emit('callEnded');
      }
    }
  });

  socket.on('disconnect', ()=>{delete users[socket.id]; io.emit('users', Object.values(users));});
});

http.listen(process.env.PORT||3000, ()=>console.log('KoloTalk REAL CALLS by Sulaiman Adebisi running'));
