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
var current = null;
var currentData = null;
var currentProgress = null;
var currentEnd = null;
var tickEnabled = false;

function handleRequest(request, response) {
  response.end(currentData);
}

function startServer() {
  win = gui.Window.get();
  window.setInterval(tick, 500);
  if(!bayeux) {
    var server = http.createServer(handleRequest);
    var bayeux = new faye.NodeAdapter({mount: '/faye', timeout: 45});
    bayeux.attach(server);
    server.listen(8000);
    console.log('Started Faye Server');
    client = new Faye.Client('http://localhost:8000/faye');
    console.log('Created Faye Client');
  }
  win.on('close', function() {
    server.close();
    this.close(true);
  });
  client.subscribe('/join', function(msg) {
    t = jwt.verify(msg.token, HMAC_SECRET);
    if(connections[t.hostname]) {
      delete connections[t.hostname];
      $('#clientListBox div#client-' + t.hostname).remove();
    }
    connections[t.hostname] = t;
    console.log('got connection from ' + t.name + ' at ' + t.hostname );
    $('#clientListBox').append('<div class="column p1 max-w20" client" id="client-' + t.hostname + '"><div class="clientStatus"><span class="left"><i class="fa fa-fw fa-user-plus"></i></span> <span class="middle"><i class="fa fa-fw fa-microphone-slash"></i></span> <span class="right"><i class="fa fa-fw fa-spinner fa-spin"></i></span></div>' + t.name + '<br/>' + t.hostname + '</div>');
    client.publish('/join/' + t.hostname, {verify: jwt.sign({hostname: t.hostname}, HMAC_SECRET)});
  });
  client.subscribe('/leave', function(msg) {
    t = jwt.verify(msg.token, HMAC_SECRET);
    console.log('dropping connection from ' + t.name + ' at ' + t.hostname );
    $('#client-' + t.hostname + ' .clientStatus .left').html('<i class="fa fa-fw fa-user-times"></i> ');
    $('#client-' + t.hostname + ' .clientStatus .middle').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ');
    $('#client-' + t.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ');
  });
  client.subscribe('/confirm', function(msg) {
    //console.log(connections[msg.hostname].name + ' confirmed ' + msg.instruction);
    if(msg.current == current) {
      $('#client-' + msg.hostname + ' .clientStatus .left').html('<i class="fa fa-fw fa-user"></i> ');
    }else{
      $('#client-' + msg.hostname + ' .clientStatus .left').html('<i class="fa fa-fw fa-user-plus"></i> ');
    }

    if(msg.instruction == "JOIN") {
      $('#client-' + msg.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-volume-off"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#222');
    }
    if(msg.instruction == "INS") {
      $('#client-' + msg.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-volume-off"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#222');
    }
    if(msg.instruction == "PLA") {
      $('#client-' + msg.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-volume-up"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#232');
    }
    if(msg.instruction == "PSE") {
      $('#client-' + msg.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-volume-off"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#222');
    }
    if(msg.instruction == "DWN") {
      $('#client-' + msg.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-volume-off"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#222');
    }
    if(msg.instruction == "ENA") {
      $('#client-' + msg.hostname + ' .clientStatus .middle').html('<i class="fa fa-fw fa-microphone"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#222');
    }
    if(msg.instruction == "DIS") {
      $('#client-' + msg.hostname + ' .clientStatus .middle').html('<i class="fa fa-fw fa-microphone-slash"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#222');
    }

    if(msg.instruction == "ERR") {
      $('#client-' + msg.hostname + ' .clientStatus .left').html('<i class="fa fa-fw fa-warning"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#422');
    }

    if(msg.instruction == "VER") {
      $('#client-' + msg.hostname + ' .clientStatus .left').html('<i class="fa fa-fw fa-warning"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#222');
    }

    if(msg.current != current || msg.current == null) {
      $('#client-' + msg.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-warning"></i> ');
      $('#client-' + msg.hostname).css('background-color', '#422');
    }
  });

  window.ondragover = function(e) {e.preventDefault(); return false;}
  window.ondrop = function(e) {e.preventDefault(); return false;}

  $(function() {
    $('input[type=range]').on('input', function () {
      $(this).trigger('change');
    });

    $('#fader').change(function() {
      pushPause();
      currentProgress = $('#fader')[0].value;

      $('#player')[0].src = currentData;
      $('#player')[0].currentTime = currentProgress;

      updateTime();
    });

    $('#fileDropTarget').on('dragover', function(e) {
      $(this).css('background-color','#464');
    });

    $('#fileDropTarget').on('dragleave', function(e) {
      $(this).css('background-color','#222');
    });

    $('#fileDropTarget').on('drop', function(e) {
      e.preventDefault();
      //pushPause();
      $(this).css('background-color','#222');
      $('#nowPlaying').html('<i class="fa fa-spinner fa-spin"></i>');
      $.each(connections, function(i, x) {
        $('#client-' + x.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ')
      });

      loadFile(e.originalEvent.dataTransfer.files[0]);
      return false;
    });
    $('#statusLine').html("Ready to go.")
  });
}

function loadFile(file, fn) {
  var reader = new FileReader();
  reader.onload = function(event) {
    current = file.name;
    currentData = event.target.result;
    currentProgress = 0;

    client.publish('/room', {instruction: "DWN", name: file.name, time: 0});
    $('#player')[0].src = currentData;
    $('#nowPlaying').html(file.name);
    updateTime();
  }
  console.log(file);
  reader.readAsDataURL(file);
}

function pushMessage() {
  $.each(connections, function(i, x) {
    $('#client-' + x.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "INS", message: $('#messageBox').val()});
}

function pushPlay() {
  $.each(connections, function(i, x) {
    $('#client-' + x.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "PLA"});
  tickEnabled = true;
  updateTime();
  $('#player')[0].play();
  $('#logo').attr('src', 'img/logo-on.png');
}

function pushUpload() {
  $.each(connections, function(i, x) {
    $('#client-' + x.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ')
  });
  currentProgress = $('#fader')[0].value;
  client.publish('/room', {instruction: "DWN", name: current, time: currentProgress});

  $('#player')[0].src = currentData;
  $('#player')[0].currentTime = currentProgress;

  updateTime();
}

function pushPause() {
  $.each(connections, function(i, x) {
    $('#client-' + x.hostname + ' .clientStatus .right').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "PSE"});
  tickEnabled = false;
  $('#player')[0].pause();
  $('#logo').attr('src', 'img/logo-off.png');
}
function pushEnable() {
  $.each(connections, function(i, x) {
    $('#client-' + x.hostname + ' .clientStatus .middle').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "ENA"});
}
function pushDisable() {
  $.each(connections, function(i, x) {
    $('#client-' + x.hostname + ' .clientStatus .middle').html('<i class="fa fa-fw fa-spinner fa-spin"></i> ')
  });
  client.publish('/room', {instruction: "DIS"});
}

function updateTime() {
  try {
    currentEnd = $('#player')[0].seekable.end(0);
  }catch(err){

  }
  currentProgress = $('#player')[0].currentTime;
  console.log('P: ' + currentProgress + " / " + currentEnd);
  $('#fader')[0].max = currentEnd;
  $('#fader')[0].value = currentProgress;
  $('#time-progress').html(timeify(currentProgress));
  $('#time-total').html(timeify(currentEnd));
}

function timeify(x) {
  m = String("00" + Math.floor(x / 60)).slice(-2);
  s = String("00" + Math.floor(x % 60)).slice(-2);

  return m + ":" + s
}

function tick() {
  if(tickEnabled) {
    updateTime();
  }
}
