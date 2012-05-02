/* The server that proxies the requests to CouchDB and serves the testrunner */
/* Props to the guys at CloudAnt for teaching me how to setup the reverse-proxy <3 */
/* Bases on: http://support.cloudant.com/customer/portal/articles/359321-how-do-i-read-and-write-to-my-cloudant-database-from-the-browser- */

var util = require('util');
var http = require('http');
var url = require('url');
var express = require('express');

var app = express.createServer();

// The remote database information
var PREFIX = '/db/';
var TARGET = 'http://localhost';
var PORT = 5984;

// set up a username and a password
// set to null if not needed
var USERNAME = '';
var PASSWORD = '';

// This app's port
var appPort = process.env['app_port'] || 3000;

// decide to forward the request or to 
function couchDBForward(req, res, next){
  var u = url.parse(req.url);
  // Only serve URLs that start with PREFIX
  if(u.pathname.substring(0, PREFIX.length) != PREFIX)
    next(); // this may be a static page request or whatever
  else{
    u = TARGET + ':' + PORT + u.pathname.substring(PREFIX.length-1) + (u.search||'');
    couchDBRequest(req, res, u);
  }
};

function error(response, error, reason, code) {
    util.log('Error '+code+': '+error+' ('+reason+').');
    response.writeHead(code, { 'Content-Type': 'application/json' });
    response.write(JSON.stringify({ error: error, reason: reason }));
    response.end();
}

function unknownError(response, e) {
    util.log(e.stack);
    error(response, 'unknown', 'Unexpected error.', 500);
}

function couchDBRequest(inRequest, inResponse, uri) {
    util.log(inRequest.method + ' ' + uri);
    uri = url.parse(uri);
    var outPort = (uri.port || 80);
    var path = uri.pathname + (uri.search || '');
    
    var headers = inRequest.headers;
    headers['host'] = uri.hostname + ':' + outPort;
    headers['x-forwarded-for'] = inRequest.connection.remoteAddress;
    headers['referer'] = 'http://' + uri.hostname + ':' + outPort + '/';

    var reqOptions = {
      hostname: uri.hostname,
      path: path,
      port: outPort,
      method: inRequest.method,
      headers: headers
    };

    if(USERNAME && PASSWORD)
      reqOptions.auth = USERNAME + ':' + PASSWORD;

    var outRequest = http.request(reqOptions, function(res){
      inResponse.statusCode = res.statusCode;

      res.on('data', function(chunk){
        inResponse.write(chunk);
      });

      res.on('end', function(){
        inResponse.end();
      });
    });

    outRequest.on('error', function(e){
      console.log('error');
      console.log(arguments);
      unknownError(inResponse, e);
    });

    if(inRequest.method == 'POST' || inRequest.method == 'PUT')
      outRequest.write(JSON.stringify(inRequest.body));

    outRequest.end();
};

process.on('uncaughtException', function(e) {
    util.log(e.stack);
});

app.configure(function(){
  app.use(express.methodOverride());
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: '2398hf8326fd236g39'}));
  app.use(couchDBForward);
  app.use(app.router);
  app.use(express.static(__dirname + '/testrunner'));
});

app.listen(appPort);