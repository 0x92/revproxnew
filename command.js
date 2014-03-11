var net = require('net');
var cp = require('child_process');
var util = require('util');
var config = require('./config.js');
var async = require('async');
var clients = {};
var proxys = [];


net.createServer(function (socket) {
	console.log("New connection to command server");
	// Handle incoming messages from clients.
	socket.on('data', function (data) {
		console.log("New data on command server");
		if (data.toString().substring(0,4) == 'ONLN') {
			//New client connected
			
			var child = cp.fork(__dirname + '/proxy.js');
			child.useratpcname = data.toString().substring(4, data.toString().indexOf('|'));
			child.pcname  = data.toString().substr( data.toString().indexOf('|') + 1);
			proxys.push(child);
			//hand the socket of to to child process, our work here is done
			child.send('cmdsock', socket);	
			child.on('message', function(m) {
				console.log('message from child', util.inspect(m));
				if (m.type == 'tunnel') {
					//got a new id for a tunnel to be established
					clients[m.data] = child;
				} else if (m.type == 'port') {
					//got number of proxy port
					child.proxyport = m.port;
					child.username = m.username;
					child.password = m.password;
				} else if (m.type == 'timeout') {
					if (clients[m.data] !== undefined) {
						delete clients[m.data];
					}	
				}
			});
			
			child.on('close', function(code, signal) {
				console.log('A child just died');
				//close and remove any unfinished tunnel connections that were for the dead child
				async.forEach(Object.keys(clients),
						function(item, callback) { 
							if (clients[item] == child) {
								delete clients[item];
							}
							callback();
						},
						function(err){
							
						}
				);
				//^-might be shit
				
				//remove child from proxy list
				var index = proxys.indexOf(child);
				if (index > -1) {
					proxys.splice(index, 1);
				}
			});
		} else if (data.toString().substring(0,4) == 'TUNN') {
			//new tunnel, hand it off to the right child process
			var id = data.toString().slice(4);
			var id = id.replace(/(\r\n|\n|\r)/gm,"");	//remove linebreaks, for testing purposes with netcat - remove later
			if (clients[id] !== undefined) {
				console.log('sending to tunnel:', id);
				try {
					clients[id].send(id, socket);
				} finally {
					delete clients[id];
				}
			} else {
				console.log('Cant find this tunnel: ' + id);
			}
		} else {
			//no idea what the fuck you want
			console.log('Unknown Command request: ' + data);
			socket.end('get out');
		}
	});
	
	socket.on('error', function(e) {
		console.log('ERROR on CMD server: ', e);
		
	});	
}).listen(config.commandport);
console.log("Command server running at port", config.commandport);

setInterval(function() { console.log('command---------------------'); console.log(util.inspect(clients, { showHidden: true, depth: 0 })) ;console.log('www---------------------');}, 5000);


module.exports.getProxys = function(cb) {
	async.map(proxys, function(item, cb) {
		cb(0, {"pcname" : item.pcname, "useratpcname" : item.useratpcname, "proxyport" : item.proxyport, "username" : item.username, "password" : item.password});
	}, function(err, result) {
		cb(result);
	});
//this function is synchronous and will  block the execution. Just a small loop but still propably better to be replaced
/* 	var result = [];
	 for (var i = 0; i < proxys.length; i++) {
		result.push({"pcname" : proxys[i].pcname, "useratpcname" : proxys[i].useratpcname, "proxyport" : proxys[i].proxyport, "username" : proxys[i].username, "password" : proxys[i].password});//Do something   useratpcname: 'Bene',
	} 
	return result; */
};