var http = require('http');
var faye = require('faye');
var jwt = require('jsonwebtoken');
var os = require("os");
var gui = require('nw.gui')
var HMAC_SECRET = "-(!EchoBoxIsTheMost SecureSystemEverDevised!)-"
var connections = {};
var client = null;
var hostname = os.hostname();
var name = "";
var server = '';
var microm = null;
var mp3 = null;
var recordEnabled = false;
var token = null;
var roomSubscription = null;
var joinSubscription = null;
var win = null;
var current = null;

function pauseBrowser(millis) {
    var date = Date.now();
    var curDate = null;
    do {
        curDate = Date.now();
    } while (curDate-date < millis);
}



$(function() {
  if(!joinSubscription) {
  win = gui.Window.get();
  win.on('close', function() {
    pushLeave();
    this.close(true);
  });
$('#join').click(function(e) {
  name = $('#name').val();
  server = $('#server').val();
  $("#statusLine").html("Trying to connect...");
  console.log("trying to connect to " + server);
  if(!client) {
    client = new Faye.Client('http://' + server + ':8000/faye');
  }
  client.on('transport:down', function() {
    $('#logo').attr('src', 'img/logo-error.png');
    $('#statusLine').html("ERROR: Realtime Transport Failed");
  });
  token = jwt.sign({name: name, hostname: hostname}, HMAC_SECRET);
  joinSubscription = client.subscribe('/join/' + hostname, function(msg) {
    verify = jwt.verify(msg.verify, HMAC_SECRET);
    console.log('confirmed as ' + verify.hostname);
    client.unsubscribe('/join/' + hostname);
    $('#joinForm').hide();
    client.publish('/confirm', {hostname: hostname, token: token, instruction: "JOIN"});
    $("#statusLine").html("Connected to " + server);
    roomSubscription = client.subscribe('/room', function(msg) {
      console.log(msg);
      if(msg.instruction == "INS") {
        $('#statusLine').html(msg.message);
      }
      if(msg.instruction == "PLA") {
        if(current) {
          $('#player')[0].play();
          $('#logo').attr('src', 'img/logo-on.png');
        }else{
          $('#logo').attr('src', 'img/logo-error.png');
          $('#statusLine').html("ERROR: No audio file on this client.");
          client.publish('/confirm', {hostname: hostname, instruction: "ERR", current: current});
        }
      }
      if(msg.instruction == "PSE") {
        $('#player')[0].pause();
        $('#logo').attr('src', 'img/logo-off.png');
      }
      if(msg.instruction == "DWN") {
        $('#player')[0].pause();
        $('#logo').attr('src', 'img/logo-off.png');
        if(current == msg.name) {
          $('#player')[0].currentTime = msg.time;
          client.publish('/confirm', {hostname: hostname, instruction: msg.instruction, current: current});
          console.log('Tconfirmed ' + msg.instruction);
        }else{
          current = msg.name;
          $.get('http://' + server + ':8000/dwn', function(data) {
            $('#player')[0].src = data;
            $('#player')[0].currentTime = msg.time;
            client.publish('/confirm', {hostname: hostname, instruction: msg.instruction, current: current});
            console.log('Dconfirmed ' + msg.instruction);
          });
      }
      }
      if(msg.instruction == "ENA") {
        recordEnabled = true;
        $('#recorderBox').show();
      }
      if(msg.instruction == "DIS") {
        recordEnabled = false;
        $('#recorderBox').hide();
      }
      if(msg.instruction != "DWN") {
        client.publish('/confirm', {hostname: hostname, instruction: msg.instruction, current: current});
        console.log('confirmed' + msg.instruction);
      }
    });
    microm = new Microm();
  });
  client.publish('/join', {token: token});
  console.log('join request sent');
});
}else{
  $("#statusLine").html("Trying to connect...");
  console.log("trying to connect to " + server);
  $('#joinForm').hide();
  client.publish('/confirm', {hostname: hostname, token: token, instruction: "JOIN"});
  $("#statusLine").html("Connected to " + server);
}
});

function pushLeave() {
  if(!client) {
    client = new Faye.Client('http://' + server + ':8000/faye');
  }
  client.publish('/leave', {hostname: hostname, token: token, instruction: "JOIN"});
  if(joinSubscription) {joinSubscription.cancel();}
  if(roomSubscription) {roomSubscription.cancel();}
  recordEnabled = false;
  $('#recorderBox').hide();
  $('#joinForm').show();
}

function recorderButton() {
  if(microm.isRecording && !microm.isPaused) {
    $('#recordControl i').removeClass('fa-pause');
    $('#recordControl i').addClass('fa-circle');
    recordPause();
  }else{
    $('#recordControl i').removeClass('fa-circle');
    $('#recordControl i').addClass('fa-pause');
    recordStart();
  }
}

function recordStart() {
  if(microm.isPaused) {
    console.log('resuming');
    microm.resumeRecording();
  }else{
    microm.record().then(function() {
      console.log('recording...')
    }).catch(function() {
      console.log('error recording');
    });
  }
}

function recordPause() {
  microm.pauseRecording();
  console.log('paused...');
}

function recordSave() {
  microm.stopRecording().then(function(result) {
    mp3 = result;
    console.log(mp3.url, mp3.blob, mp3.buffer);

    microm.download(name + '.mp3');
  });
}
