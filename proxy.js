var net = require('net');
var util = require('util');
var socks = require('./socks.js');
var config = require('./config.js');
var shortid = require('shortid');
var cmdsock;
var clients = {};
var username = config.proxyusername;
var password = shortid.generate();

process.on('message', function(m, socket) {
	console.log('CHILD got message:', m);
	if (m == 'cmdsock') {
		//We got the socket connection to send commands trough
		cmdsock = socket;
		
		cmdsock.on('error', function(e) {
			console.log('ERROR on command server ', e);
		});
		// cmd sock closes? Kill urself ;_;
		cmdsock.on('close', function () {
			console.log('CMDSock closed, exiting process');
			process.exit();
		});

	} else {
		//we got a socket connection to tunnel trough
		if (clients[m] !== undefined) {
			var id = m;
			var proxy = clients[m].proxy;
			clients[m].ready();
			delete clients[m];
			//start tunneling
			proxy.on('data', function(d) {
				try {
					//console.log('[' + id + '] receiving ' + d.length + ' bytes from proxy');
					socket.write(d);
				} catch(err) {
					console.log('[' + id + '] write error ' + err);
				}
			});
			
			socket.on('data', function(d) {
				// If the application tries to send data before the proxy is ready, then that is it's own problem.
				try {
					//console.log('[' + id + '] sending ' + d.length + ' bytes to proxy');
					proxy.write(d);
				} catch(err) {
					console.log('[' + id + '] write error ' + err);
				}
			});	
			socket.on('error', function(e) {
				console.log('[' + id + '] socket error: ' + e);
			});
			
			proxy.on('error', function(e) {
				console.log('[' + id + '] proxy error: ' + e);
			});
			
			proxy.on('close', function(had_error) {
				socket.end();
				console.error('[' + id + '] The proxy closed');
			}.bind(this));
			
			socket.on('close', function(had_error) {
				proxy.end();
				console.error('[' + id + '] The socket closed');
			}.bind(this));
						
		} else {
			console.log('[' + id + '] Cant find tunnel for this');
			socket.end();
		}
	}
});

var proxysvr = socks.createServer(username, password, function(socket, port, address, proxy_ready) {
	//new connection on the proxy server
	console.log('New proxy request to ', address, ':', port);
	//request tunnel connection
	socket.id = shortid.generate();
	clients[socket.id] = {"proxy" : socket, "ready" : proxy_ready};
	cmdsock.write('CONN' + socket.id + ':' + address + ':' + port + '~');
	process.send({"type" : "tunnel", "data" : socket.id});
	//set idle timeout for connections
	socket.setTimeout(config.idletimeout, function() {
		console.log('timeout on id ', socket.id);
		delete clients[socket.id];
		socket.end();
		process.send({"type" : "timeout", "data" : socket.id});
	});
});
//start proxy server on random free port
proxysvr.listen(0, function() {
	process.send({"type" : "port", "port" : proxysvr.address().port, "username" : username, "password" : password});
});

setInterval(function() { console.log('proxy---------------------'); console.log(util.inspect(clients, { showHidden: true, depth: 1 })) ;console.log('aaa---------------------');}, 5000)

//suicide if parent dies
process.on('disconnect', function() {
	console.log('parent exited')
	process.exit();
});

