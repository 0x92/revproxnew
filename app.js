var auth = require('http-auth');
var http = require('http');
var command = require('./command.js');
var config = require('./config.js');
var basic = auth.basic({
		realm: "Restricted Access"
    }, function (username, password, callback) {
		callback(username === config.apiauthusername && password === config.apiauthpassword);
    }
);

// Creating new HTTP server to serve list of proxies
http.createServer(basic, function(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    command.getProxys(function(result) {
		res.write(JSON.stringify(result));
	});
    res.end();
}).listen(config.apiport);
console.log("HTTP server running at port", config.apiport);
