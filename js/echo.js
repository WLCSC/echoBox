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

function startServer() {
  if(!bayeux) {
  var server = http.createServer();
  var bayeux = new faye.NodeAdapter({mount: '/faye', timeout: 45});
  console.log('Created Faye Server');
  bayeux.attach(server);
  server.listen(8000);
  console.log('Started Faye Server');
  client = new Faye.Client('http://localhost:8000/faye');
  console.log('Created Faye Client');
  }
  client.subscribe('/join', function(msg) {
    t = jwt.verify(msg.token, HMAC_SECRET);
    connections[t.hostname] = t;
    console.log('got connection from ' + t.name + ' at ' + t.hostname );
    $('#clientListBox').append('<div class="column p1 max-w20" client" id="client-' + t.hostname + '"><div class="clientStatus"><i class="fa fa-spinner fa-spin"></i></div>' + t.name + '<br/>' + t.hostname + '</div>');
    client.publish('/join/' + t.hostname, {verify: jwt.sign({hostname: t.hostname}, HMAC_SECRET)});
  });
  client.subscribe('/leave', function(msg) {
    t = jwt.verify(msg.token, HMAC_SECRET);
    delete connections[t.hostname];
    console.log('dropping connection from ' + t.name + ' at ' + t.hostname );
    $('#clientListBox div#client-' + t.hostname).remove();
  });
  client.subscribe('/confirm', function(msg) {
    console.log(connections[msg.hostname].name + ' confirmed ' + msg.instruction);
    $('#client-' + msg.hostname + ' .clientStatus').html('<i class="fa fa-check"></i> ')
  });
  window.ondragover = function(e) {e.preventDefault(); return false;}
  window.ondrop = function(e) {e.preventDefault(); return false;}
  $(function() {
    $('#fileDropTarget').on('dragover', function(e) {
      $(this).css('background-color','#464');
    });
    $('#fileDropTarget').on('dragleave', function(e) {
      $(this).css('background-color','#222');
    });
    $('#fileDropTarget').on('drop', function(e) {
      e.preventDefault();
      $(this).css('background-color','#222');
      var file = e.originalEvent.dataTransfer.files[0], reader = new FileReader();
      $('#nowPlaying').html('<i class="fa fa-spinner fa-spin"></i>');
      $.each(connections, function(x) {
        $('#client-' + x.hostname + ' .clientStatus').html('<i class="fa fa-spinner fa-spin"></i> ')
      });
      reader.onload = function(event) {
        //console.log(event.target.result);
        client.publish('/room', {instruction: "DWN", data: event.target.result});
        $('#nowPlaying').html(file.name);
      }
      console.log(file);
      reader.readAsDataURL(file);
      return false;
    });
    $('#statusLine').html("Ready to go.")
  });
}

function pushMessage() {
  $.each(connections, function(x) {
    $('#client-' + x.hostname + ' .clientStatus').html('<i class="fa fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "INS", message: $('#messageBox').val()});
}

function pushPlay() {
  $.each(connections, function(x) {
    $('#client-' + x.hostname + ' .clientStatus').html('<i class="fa fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "PLA"});
}

function pushPause() {
  $.each(connections, function(x) {
    $('#client-' + x.hostname + ' .clientStatus').html('<i class="fa fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "PSE"});
}
function pushEnable() {
  $.each(connections, function(x) {
    $('#client-' + x.hostname + ' .clientStatus').html('<i class="fa fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "ENA"});
}
function pushDisable() {
  $.each(connections, function(x) {
    $('#client-' + x.hostname + ' .clientStatus').html('<i class="fa fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "DIS"});
}


$(function() {
$('#join').click(function(e) {
  name = $('#name').val();
  server = $('#server').val();
  $("#statusLine").html("Trying to connect...");
  console.log("trying to connect to " + server);
  if(!client) {
    client = new Faye.Client('http://' + server + ':8000/faye');
  }
  token = jwt.sign({name: name, hostname: hostname}, HMAC_SECRET);
  joinSubscription = client.subscribe('/join/' + hostname, function(msg) {
    verify = jwt.verify(msg.verify, HMAC_SECRET);
    console.log('confirmed as ' + verify.hostname);
    client.unsubscribe('/join/' + hostname);
    $('#joinForm').hide();
    client.publish('/confirm', {hostname: hostname, token: token, instruction: "JOIN"});
    $("#statusLine").html("Connected to " + server);
    roomSubscription = client.subscribe('/room', function(msg) {
      console.log(msg.instruction);
      if(msg.instruction == "INS") {
        $('#statusLine').html(msg.message);
      }
      if(msg.instruction == "PLA") {
        $('#player')[0].play();
        $('#logo').attr('src', 'img/logo-on.png');
      }
      if(msg.instruction == "PSE") {
        $('#player')[0].pause();
        $('#logo').attr('src', 'img/logo-off.png');
      }
      if(msg.instruction == "DWN") {
        $('#player').attr('src', msg.data)
      }
      if(msg.instruction == "ENA") {
        recordEnabled = true;
        $('#recorderBox').show();
      }
      if(msg.instruction == "DIS") {
        recordEnabled = false;
        $('#recorderBox').hide();
      }
      client.publish('/confirm', {hostname: hostname, instruction: msg.instruction})
    });
    //microm = new Microm();
  });
  client.publish('/join', {token: token});
  console.log('join request sent');
});
});

function pushLeave() {
  if(!client) {
    client = new Faye.Client('http://' + server + ':8000/faye');
  }
  client.publish('/leave', {hostname: hostname, token: token, instruction: "JOIN"});
  joinSubscription.cancel();
  roomSubscription.cancel();
  recordEnabled = false;
  $('#recorderBox').hide();
  $('#joinForm').show();
}
/*
function recordStart() {
  microm.record().then(function() {
    console.log('recording...')
  }).catch(function() {
    console.log('error recording');
  });
}

function recordPause() {
  microm.pause().then(function() {
    console.log('paused...')
  }).catch(function() {
    console.log('error recording');
  });
}

function recordSave() {
  microm.stop().then(function(result) {
    mp3 = result;
    console.log(mp3.url, mp3.blob, mp3.buffer);

    microm.download(name + '.mp3');
  });
}
*/
